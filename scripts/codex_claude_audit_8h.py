#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv

SCRIPT_ROOT = Path("/opt/viralmind/apps/chat/scripts")
if str(SCRIPT_ROOT) not in sys.path:
    sys.path.insert(0, str(SCRIPT_ROOT))

API_ROOT = Path("/opt/viralmind/apps/api")
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

import viralmind_release_guardian as release_guardian

load_dotenv("/root/.openclaw/.env", override=False)
load_dotenv("/opt/viralmind/apps/api/.env", override=False)

ROOM_ID = os.getenv("CODEX_CLAUDE_ROOM_ID", "d0aabf34-0e5b-44da-855a-79c032bf5360").strip()
API_BASE_URL = os.getenv("CHAT_AGENT_API_BASE", "http://127.0.0.1:8000").rstrip("/")
CODEX_TOKEN = os.getenv("CODEX_AGENT_TOKEN", "").strip()
WORKER_SERVICE = "openclaw-codex-agent-worker.service"
API_SERVICE = "viralmind-api.service"
GUARDIAN_SERVICE = "openclaw-codex-claude-guardian.service"
GUARDIAN_TIMER = "openclaw-codex-claude-guardian.timer"
STATE_FILE = Path("/root/.openclaw/workspace/runtime/codex_claude_audit_8h_state.json")
CONTROL_FILE = Path("/root/.openclaw/workspace/runtime/codex_claude_audit_8h_control.json")
CHECKPOINT_SECONDS = int(os.getenv("CODEX_CLAUDE_ROADMAP_CHECKPOINT_SECONDS", "600"))

ROADMAP_MARKERS = (
    "roadmap",
    "checkpoint",
    "progresso",
    "progress",
    "eta",
    "commit",
    "t4",
    "t5",
    "t6",
    "t7",
    "t8",
)


def _run(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(list(args), text=True, capture_output=True, check=False)


def _service_active(service: str) -> bool:
    result = _run("systemctl", "is-active", service)
    return result.returncode == 0 and result.stdout.strip() == "active"


def _parse_when(raw: str) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except Exception:
        return None


def _load_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save_state(payload: dict[str, Any]) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _fetch_room_snapshot() -> dict[str, Any]:
    if not CODEX_TOKEN:
        return {"messages": [], "pending_notifications": []}
    with httpx.Client(
        base_url=API_BASE_URL,
        timeout=httpx.Timeout(20.0, connect=5.0),
        headers={"Authorization": f"Bearer {CODEX_TOKEN}"},
    ) as client:
        messages = client.get(f"/api/chat/rooms/{ROOM_ID}/messages", params={"limit": 30})
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


def _ordered_messages(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(messages, key=lambda msg: (_parse_when(msg.get("created_at") or "") or datetime.min.replace(tzinfo=timezone.utc)))


def _message_sender(msg: dict[str, Any]) -> str:
    return ((msg.get("sender") or {}).get("name") or msg.get("sender_name") or "").strip()


def _message_age_seconds(msg: dict[str, Any] | None) -> float | None:
    if not msg:
        return None
    created_at = _parse_when(msg.get("created_at") or "")
    if not created_at:
        return None
    return (datetime.now(timezone.utc) - created_at).total_seconds()


def _latest_claude_progress_message(messages: list[dict[str, Any]]) -> dict[str, Any] | None:
    for msg in reversed(_ordered_messages(messages)):
        if _message_sender(msg) != "Claude Code":
            continue
        content = (msg.get("content") or "").lower()
        if any(marker in content for marker in ROADMAP_MARKERS):
            return msg
    return None


def _latest_codex_block_message(messages: list[dict[str, Any]]) -> dict[str, Any] | None:
    for msg in reversed(_ordered_messages(messages)):
        if _message_sender(msg) != "Codex":
            continue
        content = (msg.get("content") or "").lower()
        if any(marker in content for marker in ("bloqueio:", "status: bloqueado", "rodei a sequencia ate bater no bloqueio", "comando nao permitido")):
            return msg
    return None


def _run_safe_deploy_cycle() -> list[dict[str, Any]]:
    return [release_guardian._deploy_target(release_guardian._target_status(target)) for target in release_guardian.TARGETS]


def _render_deploy_summary(results: list[dict[str, Any]]) -> str:
    lines = ["Checkpoint de deploy seguro:"]
    for item in results:
        line = f"- `{item['target']}`: {item['status']}"
        if item["actions"]:
            line += f" | ações: {', '.join(item['actions'])}"
        if item["critical"]:
            line += f" | crítico: {'; '.join(item['critical'])}"
        lines.append(line)
    return "\n".join(lines)


def main() -> None:
    control = _load_json(CONTROL_FILE)
    state = _load_json(STATE_FILE)
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

    _run("systemctl", "start", GUARDIAN_SERVICE)
    actions.append("run_guardian_once")

    snapshot = _fetch_room_snapshot()
    messages = snapshot["messages"]
    pending = [n for n in snapshot["pending_notifications"] if (n.get("room_id") or "") == ROOM_ID]
    latest_claude_progress = _latest_claude_progress_message(messages)
    latest_claude_progress_age = _message_age_seconds(latest_claude_progress)
    latest_block = _latest_codex_block_message(messages)

    deploy_results = _run_safe_deploy_cycle()
    deploy_signature = json.dumps(deploy_results, sort_keys=True, ensure_ascii=False)
    last_deploy_signature = state.get("last_deploy_signature")
    if deploy_signature != last_deploy_signature and any(item["actions"] or item["critical"] for item in deploy_results):
        _post_room_message(_render_deploy_summary(deploy_results))
        actions.append("post_deploy_summary")

    last_checkpoint_at = _parse_when(state.get("last_checkpoint_at") or "")
    checkpoint_due = (
        (latest_claude_progress_age is None or latest_claude_progress_age >= CHECKPOINT_SECONDS)
        and not pending
        and (not last_checkpoint_at or (now - last_checkpoint_at).total_seconds() >= CHECKPOINT_SECONDS)
    )
    if checkpoint_due:
        _post_room_message(
            "Claude, checkpoint de roadmap dos ultimos 10 min: quais frentes fecharam, quais commits subiram, "
            "se existe deploy pendente e se apareceu algum bloqueio novo. Se nao houver bloqueio, segue na proxima melhoria "
            "de maior impacto no produto e eu cubro deploy/smoke quando entrar runtime."
        )
        state["last_checkpoint_at"] = now.isoformat()
        actions.append("post_roadmap_checkpoint")

    _save_state(
        {
            "status": "active",
            "checked_at": now.isoformat(),
            "configured_end_at": end_at.isoformat() if end_at else None,
            "api_active": _service_active(API_SERVICE),
            "worker_active": _service_active(WORKER_SERVICE),
            "guardian_timer_active": _service_active(GUARDIAN_TIMER),
            "room_pending_count": len(pending),
            "latest_claude_progress_id": (latest_claude_progress or {}).get("id"),
            "latest_claude_progress_age_seconds": latest_claude_progress_age,
            "latest_codex_block_id": (latest_block or {}).get("id"),
            "deploy_results": deploy_results,
            "last_deploy_signature": deploy_signature,
            "last_checkpoint_at": state.get("last_checkpoint_at"),
            "actions": actions,
        }
    )


if __name__ == "__main__":
    main()
