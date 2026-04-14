#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv

API_ROOT = Path("/opt/viralmind/apps/api")
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))


load_dotenv("/root/.openclaw/.env", override=False)
load_dotenv("/opt/viralmind/apps/api/.env", override=False)

ROOM_ID = os.getenv("CODEX_CLAUDE_ROOM_ID", "d0aabf34-0e5b-44da-855a-79c032bf5360").strip()
API_BASE_URL = os.getenv("CHAT_AGENT_API_BASE", "http://127.0.0.1:8000").rstrip("/")
CODEX_TOKEN = os.getenv("CODEX_AGENT_TOKEN", "").strip()
WORKER_SERVICE = "openclaw-codex-agent-worker.service"
API_SERVICE = "viralmind-api.service"
GUARDIAN_SERVICE = "openclaw-codex-claude-guardian.service"
GUARDIAN_TIMER = "openclaw-codex-claude-guardian.timer"
STATE_FILE = Path("/root/.openclaw/workspace/runtime/codex_claude_audit_5h_state.json")
CONTROL_FILE = Path("/root/.openclaw/workspace/runtime/codex_claude_audit_5h_control.json")
IDLE_NUDGE_SECONDS = int(os.getenv("CODEX_CLAUDE_AUDIT_IDLE_NUDGE_SECONDS", "300"))
IDLE_NUDGE_COOLDOWN_SECONDS = int(os.getenv("CODEX_CLAUDE_AUDIT_IDLE_NUDGE_COOLDOWN_SECONDS", "900"))


def _run(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(list(args), text=True, capture_output=True, check=False)


def _service_active(service: str) -> bool:
    result = _run("systemctl", "is-active", service)
    return result.returncode == 0 and result.stdout.strip() == "active"


def _load_control() -> dict[str, Any]:
    try:
        return json.loads(CONTROL_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save_state(payload: dict[str, Any]) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _parse_when(raw: str) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except Exception:
        return None


def _fetch_room_snapshot() -> dict[str, Any]:
    if not CODEX_TOKEN:
        return {"messages": [], "pending_notifications": []}
    with httpx.Client(
        base_url=API_BASE_URL,
        timeout=httpx.Timeout(20.0, connect=5.0),
        headers={"Authorization": f"Bearer {CODEX_TOKEN}"},
    ) as client:
        messages = client.get(f"/api/chat/rooms/{ROOM_ID}/messages", params={"limit": 20})
        messages.raise_for_status()
        pending = client.get("/api/chat/agents/me/pending")
        pending.raise_for_status()
    return {
        "messages": messages.json().get("messages", []),
        "pending_notifications": pending.json().get("notifications", []),
    }


def _post_room_message(content: str) -> bool:
    if not CODEX_TOKEN:
        return False
    with httpx.Client(
        base_url=API_BASE_URL,
        timeout=httpx.Timeout(20.0, connect=5.0),
        headers={"Authorization": f"Bearer {CODEX_TOKEN}"},
    ) as client:
        response = client.post(f"/api/chat/rooms/{ROOM_ID}/messages", json={"content": content})
        response.raise_for_status()
    return True


def _last_message(messages: list[dict[str, Any]]) -> dict[str, Any] | None:
    ordered = sorted(messages, key=lambda msg: (_parse_when(msg.get("created_at") or "") or datetime.min.replace(tzinfo=timezone.utc)))
    return ordered[-1] if ordered else None


def _message_age_seconds(msg: dict[str, Any] | None) -> float | None:
    if not msg:
        return None
    created_at = _parse_when(msg.get("created_at") or "")
    if not created_at:
        return None
    return (datetime.now(timezone.utc) - created_at).total_seconds()


def main() -> None:
    control = _load_control()
    now = datetime.now(timezone.utc)
    end_at = _parse_when(control.get("end_at") or "")
    if end_at and now > end_at:
        _save_state(
            {
                "status": "expired",
                "ended_at": now.isoformat(),
                "configured_end_at": end_at.isoformat(),
            }
        )
        return

    actions: list[str] = []
    if not _service_active(API_SERVICE):
        _run("systemctl", "restart", API_SERVICE)
        actions.append("restart_api")
    if not _service_active(WORKER_SERVICE):
        _run("systemctl", "restart", WORKER_SERVICE)
        actions.append("restart_worker")
    if not _service_active(GUARDIAN_TIMER):
        _run("systemctl", "restart", GUARDIAN_TIMER)
        actions.append("restart_guardian_timer")

    # Always run the fast guardian once during the audit window.
    _run("systemctl", "start", GUARDIAN_SERVICE)
    actions.append("run_guardian_once")

    snapshot = _fetch_room_snapshot()
    messages = snapshot["messages"]
    pending = [n for n in snapshot["pending_notifications"] if (n.get("room_id") or "") == ROOM_ID]
    last_msg = _last_message(messages)
    last_msg_age = _message_age_seconds(last_msg)

    idle_nudge_sent = False
    last_idle_nudge_at = _parse_when(state.get("last_idle_nudge_at") or "")
    idle_nudge_due = (
        (last_msg_age or 0) >= IDLE_NUDGE_SECONDS
        and not pending
        and (not last_idle_nudge_at or (now - last_idle_nudge_at).total_seconds() >= IDLE_NUDGE_COOLDOWN_SECONDS)
    )
    if idle_nudge_due:
        idle_nudge_sent = _post_room_message(
            "A sala esfriou sem pendencia aberta. Vamos manter throughput: escolham a melhoria de maior impacto agora e executem. "
            "Pode ser bug, UX/UI, verdade dos dados, fluxo de memoria, ranking de padrões ou corpus/trending. "
            "Claude implementa a frente; eu reviso, deployo, faço smoke e fecho o root cause se aparecer bloqueio."
        )
        if idle_nudge_sent:
            actions.append("post_idle_nudge")
            state["last_idle_nudge_at"] = now.isoformat()

    _save_state(
        {
            "status": "active",
            "checked_at": now.isoformat(),
            "configured_end_at": end_at.isoformat() if end_at else None,
            "api_active": _service_active(API_SERVICE),
            "worker_active": _service_active(WORKER_SERVICE),
            "guardian_timer_active": _service_active(GUARDIAN_TIMER),
            "room_pending_count": len(pending),
            "last_message_sender": (last_msg or {}).get("sender_name"),
            "last_message_id": (last_msg or {}).get("id"),
            "last_message_age_seconds": last_msg_age,
            "idle_nudge_sent": idle_nudge_sent,
            "actions": actions,
            "last_idle_nudge_at": state.get("last_idle_nudge_at"),
        }
    )


if __name__ == "__main__":
    main()
