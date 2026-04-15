#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
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

from models.database import get_chat_supabase_admin


load_dotenv("/root/.openclaw/.env", override=False)
load_dotenv("/opt/viralmind/apps/api/.env", override=False)

ROOM_ID = os.getenv("CODEX_CLAUDE_ROOM_ID", "d0aabf34-0e5b-44da-855a-79c032bf5360").strip()
API_BASE_URL = os.getenv("CHAT_AGENT_API_BASE", "http://127.0.0.1:8000").rstrip("/")
CODEX_TOKEN = os.getenv("CODEX_AGENT_TOKEN", "").strip()
CODEX_AGENT_ID = os.getenv("CODEX_AGENT_ID", "789033d5-66de-4ef0-b4f4-183452b5a81c").strip()
WORKER_SERVICE = os.getenv("CODEX_CLAUDE_WORKER_SERVICE", "openclaw-codex-agent-worker.service").strip()
AUDIT_SERVICE = os.getenv("CODEX_CLAUDE_AUDIT_SERVICE", "openclaw-codex-claude-audit-8h.service").strip()
STALE_SECONDS = int(os.getenv("CODEX_CLAUDE_STALE_SECONDS", "90"))
STATE_FILE = Path("/root/.openclaw/workspace/runtime/codex_claude_guardian_state.json")
FOLLOW_UP_PROMISE_RE = re.compile(
    r"\b(volto com|volto assim que|assim que sair o n[uú]mero|depois eu retorno|"
    r"logo na sequ[êe]ncia|j[aá] est[aá] rodando|refresh j[aá] est[aá] rodando)\b",
    flags=re.IGNORECASE,
)
BLOCKED_REPLY_RE = re.compile(
    r"(?:^|\n)\s*(?:bloqueio:|status:\s*bloqueado|rodei a sequencia ate bater no bloqueio|comando nao permitido)",
    flags=re.IGNORECASE,
)


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
    ordered = sorted(messages, key=lambda msg: (_parse_when(msg.get("created_at") or "") or datetime.min.replace(tzinfo=timezone.utc)))
    latest_claude_index: int | None = None
    latest_claude: dict[str, Any] | None = None
    for idx, msg in enumerate(ordered):
        sender = ((msg.get("sender") or {}).get("name") or msg.get("sender_name") or "").strip()
        if sender == "Claude Code":
            latest_claude_index = idx
            latest_claude = msg
    if not latest_claude:
        return False, None, 0.0
    if latest_claude_index is not None:
        for msg in ordered[latest_claude_index + 1 :]:
            sender = ((msg.get("sender") or {}).get("name") or msg.get("sender_name") or "").strip()
            if sender == "Codex":
                return False, latest_claude.get("id"), 0.0
    created_at = _parse_when(latest_claude.get("created_at") or "")
    age = (datetime.now(timezone.utc) - created_at).total_seconds() if created_at else 0.0
    return age >= STALE_SECONDS, latest_claude.get("id"), age


def _room_has_unanswered_hugo(messages: list[dict[str, Any]]) -> tuple[bool, str | None, float]:
    ordered = sorted(messages, key=lambda msg: (_parse_when(msg.get("created_at") or "") or datetime.min.replace(tzinfo=timezone.utc)))
    latest_hugo_index: int | None = None
    latest_hugo: dict[str, Any] | None = None
    for idx, msg in enumerate(ordered):
        sender = ((msg.get("sender") or {}).get("name") or msg.get("sender_name") or "").strip()
        if sender == "Hugo Venda":
            latest_hugo_index = idx
            latest_hugo = msg
    if not latest_hugo:
        return False, None, 0.0
    if latest_hugo_index is not None:
        for msg in ordered[latest_hugo_index + 1 :]:
            sender = ((msg.get("sender") or {}).get("name") or msg.get("sender_name") or "").strip()
            if sender == "Codex":
                return False, latest_hugo.get("id"), 0.0
    created_at = _parse_when(latest_hugo.get("created_at") or "")
    age = (datetime.now(timezone.utc) - created_at).total_seconds() if created_at else 0.0
    return age >= STALE_SECONDS, latest_hugo.get("id"), age


def _room_has_open_codex_followup(messages: list[dict[str, Any]]) -> tuple[bool, str | None, str | None, float]:
    ordered = sorted(messages, key=lambda msg: (_parse_when(msg.get("created_at") or "") or datetime.min.replace(tzinfo=timezone.utc)))
    latest_promise_index: int | None = None
    latest_promise: dict[str, Any] | None = None
    for idx, msg in enumerate(ordered):
        sender = ((msg.get("sender") or {}).get("name") or msg.get("sender_name") or "").strip()
        content = (msg.get("content") or "").strip()
        if sender == "Codex" and FOLLOW_UP_PROMISE_RE.search(content):
            latest_promise_index = idx
            latest_promise = msg
    if latest_promise_index is None or not latest_promise:
        return False, None, None, 0.0
    for msg in ordered[latest_promise_index + 1 :]:
        sender = ((msg.get("sender") or {}).get("name") or msg.get("sender_name") or "").strip()
        if sender == "Codex":
            return False, latest_promise.get("id"), None, 0.0
    trigger_message_id = None
    for msg in reversed(ordered[:latest_promise_index]):
        sender = ((msg.get("sender") or {}).get("name") or msg.get("sender_name") or "").strip()
        if sender != "Codex":
            trigger_message_id = msg.get("id")
            break
    created_at = _parse_when(latest_promise.get("created_at") or "")
    age = (datetime.now(timezone.utc) - created_at).total_seconds() if created_at else 0.0
    return age >= STALE_SECONDS, latest_promise.get("id"), trigger_message_id, age


def _room_has_retryable_codex_block(messages: list[dict[str, Any]]) -> tuple[bool, str | None, str | None, float]:
    ordered = sorted(messages, key=lambda msg: (_parse_when(msg.get("created_at") or "") or datetime.min.replace(tzinfo=timezone.utc)))
    latest_block_index: int | None = None
    latest_block: dict[str, Any] | None = None
    for idx, msg in enumerate(ordered):
        sender = ((msg.get("sender") or {}).get("name") or msg.get("sender_name") or "").strip()
        content = (msg.get("content") or "").strip()
        if sender == "Codex" and BLOCKED_REPLY_RE.search(content):
            latest_block_index = idx
            latest_block = msg
    if latest_block_index is None or not latest_block:
        return False, None, None, 0.0
    for msg in ordered[latest_block_index + 1 :]:
        sender = ((msg.get("sender") or {}).get("name") or msg.get("sender_name") or "").strip()
        if sender == "Codex":
            return False, latest_block.get("id"), None, 0.0
    trigger_message_id = None
    for msg in reversed(ordered[:latest_block_index]):
        sender = ((msg.get("sender") or {}).get("name") or msg.get("sender_name") or "").strip()
        if sender != "Codex":
            trigger_message_id = msg.get("id")
            break
    created_at = _parse_when(latest_block.get("created_at") or "")
    age = (datetime.now(timezone.utc) - created_at).total_seconds() if created_at else 0.0
    return age >= STALE_SECONDS, latest_block.get("id"), trigger_message_id, age


def _ensure_pending_notification(message_id: str | None) -> bool:
    if not message_id:
        return False
    sb = get_chat_supabase_admin()
    existing = (
        sb.table("chat_notifications")
        .select("id,status")
        .eq("agent_id", CODEX_AGENT_ID)
        .eq("message_id", message_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    ).data or []
    if existing and existing[0].get("status") == "pending":
        return False
    sb.table("chat_notifications").insert(
        {
            "agent_id": CODEX_AGENT_ID,
            "room_id": ROOM_ID,
            "message_id": message_id,
            "status": "pending",
        }
    ).execute()
    return True


def _latest_message_content(messages: list[dict[str, Any]], message_id: str | None) -> str:
    if not message_id:
        return ""
    for msg in messages:
        if msg.get("id") == message_id:
            return (msg.get("content") or "").strip()
    return ""


def _block_signature(content: str) -> str:
    lowered = (content or "").lower()
    if "git subcomando nao permitido" in lowered:
        return "git_allowlist"
    if "migration fora das roots permitidas" in lowered:
        return "migration_path"
    if "comando nao permitido" in lowered:
        return "command_allowlist"
    return "generic_block"


def main() -> None:
    state = _load_state()
    pending, messages = _fetch_pending_and_room()
    worker_ok = _service_active(WORKER_SERVICE)
    stale_room, stale_message_id, stale_age = _room_has_unanswered_claude(messages)
    stale_hugo, stale_hugo_message_id, stale_hugo_age = _room_has_unanswered_hugo(messages)
    stale_followup, stale_followup_id, followup_trigger_id, stale_followup_age = _room_has_open_codex_followup(messages)
    stale_block, stale_block_id, blocked_trigger_id, stale_block_age = _room_has_retryable_codex_block(messages)
    room_pending = [n for n in pending if (n.get("room_id") or "") == ROOM_ID]

    restart_reason = None
    requeued = False
    if not worker_ok:
        restart_reason = "worker_inactive"
    elif stale_followup and followup_trigger_id:
        last_restarted_for = state.get("last_restarted_for_followup_id")
        if stale_followup_id and stale_followup_id != last_restarted_for:
            requeued = _ensure_pending_notification(followup_trigger_id)
            if requeued:
                restart_reason = "requeued_open_codex_followup"
    elif stale_block and blocked_trigger_id:
        last_restarted_for = state.get("last_restarted_for_blocked_reply_id")
        if stale_block_id and stale_block_id != last_restarted_for:
            requeued = _ensure_pending_notification(blocked_trigger_id)
            if requeued:
                restart_reason = "requeued_retryable_codex_block"
    elif room_pending and stale_room:
        last_restarted_for = state.get("last_restarted_for_message_id")
        if stale_message_id and stale_message_id != last_restarted_for:
            restart_reason = "stale_pending_message"
    elif stale_hugo and stale_hugo_message_id:
        requeued = _ensure_pending_notification(stale_hugo_message_id)
        if requeued:
            restart_reason = "requeued_stale_hugo_message"
    elif stale_room and stale_message_id:
        requeued = _ensure_pending_notification(stale_message_id)
        if requeued:
            restart_reason = "requeued_stale_room_message"

    if restart_reason:
        _run("systemctl", "restart", WORKER_SERVICE)
        if restart_reason in {"requeued_retryable_codex_block", "requeued_open_codex_followup"}:
            _run("systemctl", "start", AUDIT_SERVICE)
        state["last_restart_at"] = datetime.now(timezone.utc).isoformat()
        state["last_restart_reason"] = restart_reason
        state["last_restarted_for_message_id"] = stale_message_id
        state["last_restarted_for_followup_id"] = stale_followup_id
        state["last_restarted_for_blocked_reply_id"] = stale_block_id

    state["worker_active"] = _service_active(WORKER_SERVICE)
    state["room_pending_count"] = len(room_pending)
    state["stale_room_message"] = stale_room
    state["stale_room_age_seconds"] = stale_age
    state["stale_hugo_message"] = stale_hugo
    state["stale_hugo_age_seconds"] = stale_hugo_age
    state["stale_hugo_message_id"] = stale_hugo_message_id
    state["open_codex_followup"] = stale_followup
    state["open_codex_followup_age_seconds"] = stale_followup_age
    state["open_codex_followup_message_id"] = stale_followup_id
    state["retryable_codex_block"] = stale_block
    state["retryable_codex_block_age_seconds"] = stale_block_age
    state["retryable_codex_block_message_id"] = stale_block_id
    state["retryable_codex_block_signature"] = _block_signature(_latest_message_content(messages, stale_block_id))
    state["audit_service_triggered"] = restart_reason in {"requeued_retryable_codex_block", "requeued_open_codex_followup"}
    state["requeued_stale_message"] = requeued
    state["last_checked_at"] = datetime.now(timezone.utc).isoformat()
    _save_state(state)


if __name__ == "__main__":
    main()
