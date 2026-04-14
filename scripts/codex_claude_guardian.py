#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv


load_dotenv("/root/.openclaw/.env", override=False)
load_dotenv("/opt/viralmind/apps/api/.env", override=False)

ROOM_ID = os.getenv("CODEX_CLAUDE_ROOM_ID", "d0aabf34-0e5b-44da-855a-79c032bf5360").strip()
API_BASE_URL = os.getenv("CHAT_AGENT_API_BASE", "http://127.0.0.1:8000").rstrip("/")
CODEX_TOKEN = os.getenv("CODEX_AGENT_TOKEN", "").strip()
WORKER_SERVICE = os.getenv("CODEX_CLAUDE_WORKER_SERVICE", "openclaw-codex-agent-worker.service").strip()
STALE_SECONDS = int(os.getenv("CODEX_CLAUDE_STALE_SECONDS", "90"))
STATE_FILE = Path("/root/.openclaw/workspace/runtime/codex_claude_guardian_state.json")


def _load_state() -> dict[str, Any]:
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save_state(payload: dict[str, Any]) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


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


def _fetch_pending_and_room() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    if not CODEX_TOKEN:
        return [], []
    with httpx.Client(
        base_url=API_BASE_URL,
        timeout=httpx.Timeout(20.0, connect=5.0),
        headers={"Authorization": f"Bearer {CODEX_TOKEN}"},
    ) as client:
        pending_resp = client.get("/api/chat/agents/me/pending")
        pending_resp.raise_for_status()
        room_resp = client.get(f"/api/chat/rooms/{ROOM_ID}/messages", params={"limit": 20})
        room_resp.raise_for_status()
        pending_payload = pending_resp.json() if pending_resp.content else {}
        room_payload = room_resp.json() if room_resp.content else {}
    return pending_payload.get("notifications", []), room_payload.get("messages", [])


def _room_has_unanswered_claude(messages: list[dict[str, Any]]) -> tuple[bool, str | None, float]:
    latest_claude: dict[str, Any] | None = None
    latest_codex_after: dict[str, Any] | None = None
    for msg in reversed(messages):
        sender = ((msg.get("sender") or {}).get("name") or msg.get("sender_name") or "").strip()
        if not latest_claude and sender == "Claude Code":
            latest_claude = msg
            continue
        if latest_claude and sender == "Codex":
            latest_codex_after = msg
            break
    if not latest_claude:
        return False, None, 0.0
    if latest_codex_after:
        claude_at = _parse_when(latest_claude.get("created_at") or "")
        codex_at = _parse_when(latest_codex_after.get("created_at") or "")
        if claude_at and codex_at and codex_at >= claude_at:
            return False, latest_claude.get("id"), 0.0
    created_at = _parse_when(latest_claude.get("created_at") or "")
    age = (datetime.now(timezone.utc) - created_at).total_seconds() if created_at else 0.0
    return age >= STALE_SECONDS, latest_claude.get("id"), age


def main() -> None:
    state = _load_state()
    pending, messages = _fetch_pending_and_room()
    worker_ok = _service_active(WORKER_SERVICE)
    stale_room, stale_message_id, stale_age = _room_has_unanswered_claude(messages)
    room_pending = [n for n in pending if (n.get("room_id") or "") == ROOM_ID]

    restart_reason = None
    if not worker_ok:
        restart_reason = "worker_inactive"
    elif room_pending and stale_room:
        last_restarted_for = state.get("last_restarted_for_message_id")
        if stale_message_id and stale_message_id != last_restarted_for:
            restart_reason = "stale_pending_message"

    if restart_reason:
        _run("systemctl", "restart", WORKER_SERVICE)
        state["last_restart_at"] = datetime.now(timezone.utc).isoformat()
        state["last_restart_reason"] = restart_reason
        state["last_restarted_for_message_id"] = stale_message_id

    state["worker_active"] = _service_active(WORKER_SERVICE)
    state["room_pending_count"] = len(room_pending)
    state["stale_room_message"] = stale_room
    state["stale_room_age_seconds"] = stale_age
    state["last_checked_at"] = datetime.now(timezone.utc).isoformat()
    _save_state(state)


if __name__ == "__main__":
    main()
