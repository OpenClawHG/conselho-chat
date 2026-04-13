#!/usr/bin/env python3
"""
Loop mínimo de trabalho do ViralMind.

- usa o board `ViralMind / Operacional` como backlog canônico;
- verifica cards ativos (`Priorizado`, `Em Andamento`);
- mede a última atualização do owner no canal `ViralMind / geral`;
- cobra o owner quando o card fica parado além da janela de idle;
- evita spam com state file simples.
"""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

import psycopg
from dotenv import load_dotenv


API_ROOT = Path("/opt/viralmind/apps/api")
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from services.planka_service import get_planka_client
from services.viralmind_planka import (
    VIRALMIND_BOARD_NAME,
    VIRALMIND_CANONICAL_CARDS,
    VIRALMIND_PROJECT_NAME,
)


load_dotenv("/root/.openclaw/.env", override=False)
load_dotenv("/opt/viralmind/apps/api/.env", override=False)

ROOM_ID = os.getenv("VIRALMIND_ROOM_ID", "c091861b-161e-415a-bd79-1b4d559c844b")
CHAT_DB = os.getenv("CHAT_DATABASE_URL", "").strip()
API_BASE = os.getenv("CHAT_AGENT_API_BASE", "http://127.0.0.1:8000").rstrip("/") + "/api/chat"
CODEX_TOKEN = os.getenv("CODEX_AGENT_TOKEN", "").strip()
IDLE_MINUTES = int(os.getenv("VIRALMIND_IDLE_MINUTES", "10"))
REMINDER_COOLDOWN_MINUTES = int(os.getenv("VIRALMIND_REMINDER_COOLDOWN_MINUTES", "20"))
STATE_FILE = Path("/root/.openclaw/workspace/runtime/viralmind_workloop_state.json")
ACTIVE_LISTS = {"Priorizado", "Em Andamento"}
EVIDENCE_PATTERNS = [
    r"\bcommit\b",
    r"\bhash\b",
    r"\bpr\b",
    r"\bteste\b",
    r"\btestes\b",
    r"\bsmoke test\b",
    r"\bsmoke\b",
    r"\bcurl\b",
    r"\bendpoint\b",
    r"\bstatus code\b",
    r"\b200 ok\b",
    r"\bapply_patch\b",
    r"\bmigration\b",
    r"\bsql\b",
    r"\bsupabase\b",
    r"\bbuild\b",
    r"\bdeploy\b",
    r"\bps\b",
    r"\bservice\b",
    r"\bresultado\b",
    r"\bevid[eê]ncia\b",
    r"\bgravei\b",
    r"\bregistrei\b",
]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _load_state() -> dict:
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save_state(payload: dict) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _api_post(url: str, token: str, data: dict) -> dict | None:
    body = json.dumps(data).encode()
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.URLError as exc:
        print(f"API error: {exc}", file=sys.stderr)
        return None


def post_room_message(message: str) -> dict | None:
    if not CODEX_TOKEN:
        print("CODEX_AGENT_TOKEN ausente; cobrança não enviada", file=sys.stderr)
        return None
    url = f"{API_BASE}/rooms/{ROOM_ID}/messages"
    return _api_post(url, CODEX_TOKEN, {"content": message})


def _get_board_cards() -> list[dict]:
    client = get_planka_client()
    project = client.get_project_by_name(VIRALMIND_PROJECT_NAME)
    if not project:
        raise RuntimeError("Projeto ViralMind não encontrado no Planka")
    board = client.get_board_by_name(project["id"], VIRALMIND_BOARD_NAME)
    if not board:
        raise RuntimeError("Board Operacional do ViralMind não encontrado no Planka")
    payload = client.get_board(board["id"])
    included = payload.get("included") or {}
    lists = {
        item["id"]: item["name"]
        for item in included.get("lists") or []
        if item.get("type") == "active"
    }
    cards = included.get("cards") or []
    rows: list[dict] = []
    for spec in VIRALMIND_CANONICAL_CARDS:
        marker = f"<!-- viralmind-card:{spec['key']} -->"
        match = next((card for card in cards if marker in (card.get("description") or "")), None)
        if not match:
            continue
        rows.append(
            {
                "key": spec["key"],
                "name": spec["name"],
                "owner": spec["owner"],
                "list_name": lists.get(match.get("listId")),
            }
        )
    return rows


def _connect_chat_db():
    if not CHAT_DB:
        raise RuntimeError("CHAT_DATABASE_URL ausente")
    return psycopg.connect(CHAT_DB)


def _latest_owner_card_update(owner: str, card_name: str) -> datetime | None:
    with _connect_chat_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            select m.created_at
            from chat_messages m
            join chat_agents a on a.id = m.sender_id
            where m.room_id = %s
              and a.name = %s
              and m.content ilike %s
            order by m.created_at desc
            limit 1
            """,
            (ROOM_ID, owner, f"%{card_name}%"),
        )
        row = cur.fetchone()
    return row[0] if row else None


def _latest_owner_card_evidence_update(owner: str, card_name: str) -> tuple[datetime | None, str | None]:
    pattern_sql = " OR ".join(["m.content ~* %s" for _ in EVIDENCE_PATTERNS])
    params: list[object] = [ROOM_ID, owner, f"%{card_name}%"]
    params.extend(EVIDENCE_PATTERNS)
    query = f"""
        select m.created_at, left(replace(m.content, E'\\n', ' '), 280)
        from chat_messages m
        join chat_agents a on a.id = m.sender_id
        where m.room_id = %s
          and a.name = %s
          and m.content ilike %s
          and ({pattern_sql})
        order by m.created_at desc
        limit 1
    """
    with _connect_chat_db() as conn, conn.cursor() as cur:
        cur.execute(query, params)
        row = cur.fetchone()
    if not row:
        return None, None
    return row[0], row[1]


def _latest_room_activity_from(sender: str) -> datetime | None:
    with _connect_chat_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            select m.created_at
            from chat_messages m
            join chat_agents a on a.id = m.sender_id
            where m.room_id = %s
              and a.name = %s
            order by m.created_at desc
            limit 1
            """,
            (ROOM_ID, sender),
        )
        row = cur.fetchone()
    return row[0] if row else None


def _owner_has_pending_notifications(owner: str) -> int:
    with _connect_chat_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            select count(*)
            from chat_notifications n
            join chat_agents a on a.id = n.agent_id
            where n.room_id = %s
              and n.status = 'pending'
              and a.name = %s
            """,
            (ROOM_ID, owner),
        )
        row = cur.fetchone()
    return int(row[0] or 0) if row else 0


def _should_remind(card_key: str, last_update: datetime | None, now: datetime) -> bool:
    state = _load_state()
    reminder = (state.get("reminders") or {}).get(card_key) or {}
    last_reminder_at_raw = reminder.get("last_reminder_at")
    if not last_reminder_at_raw:
        return True
    try:
        last_reminder_at = datetime.fromisoformat(last_reminder_at_raw.replace("Z", "+00:00"))
    except Exception:
        return True
    if last_update and last_update > last_reminder_at:
        return True
    return (now - last_reminder_at) >= timedelta(minutes=REMINDER_COOLDOWN_MINUTES)


def _record_reminder(card_key: str, now: datetime) -> None:
    state = _load_state()
    reminders = state.setdefault("reminders", {})
    reminders[card_key] = {
        "last_reminder_at": now.replace(microsecond=0).isoformat().replace("+00:00", "Z")
    }
    _save_state(state)


def _build_idle_reason(owner: str, *, last_update: datetime | None, last_evidence: datetime | None) -> str:
    pending = _owner_has_pending_notifications(owner)
    if pending > 0:
        return f"{pending} notificações pendentes"
    if last_update and not last_evidence:
        idle_minutes = int((_now() - last_update).total_seconds() / 60)
        return f"houve fala no canal, mas sem evidência verificável há ~{idle_minutes}min"
    if last_evidence:
        idle_minutes = int((_now() - last_evidence).total_seconds() / 60)
        return f"sem evidência verificável no canal há ~{idle_minutes}min"
    latest = _latest_room_activity_from(owner)
    if latest:
        idle_minutes = int((_now() - latest).total_seconds() / 60)
        return f"sem update recente no canal há ~{idle_minutes}min"
    return "sem update útil registrado no canal"


def main() -> None:
    now = _now()
    cards = _get_board_cards()
    active_cards = [card for card in cards if card.get("list_name") in ACTIVE_LISTS]

    lines: list[str] = []
    for card in active_cards:
        owner = card["owner"]
        last_update = _latest_owner_card_update(owner, card["name"])
        last_evidence, evidence_excerpt = _latest_owner_card_evidence_update(owner, card["name"])
        idle = last_evidence is None or (now - last_evidence) >= timedelta(minutes=IDLE_MINUTES)
        if not idle:
            continue
        freshness_marker = last_evidence or last_update
        if not _should_remind(card["key"], freshness_marker, now):
            continue
        reason = _build_idle_reason(owner, last_update=last_update, last_evidence=last_evidence)
        guidance = "Responder agora com: `Card`, `Status`, `Evidência`, `Próximo passo`, `Bloqueio`."
        if evidence_excerpt:
            guidance += f" Última evidência vista: {evidence_excerpt}"
        lines.append(
            f"@{owner} card parado: `{card['name']}` | lista: `{card['list_name']}` | motivo observado: {reason}. "
            f"{guidance}"
        )

    if not lines:
        print("ViralMind workloop OK: sem owners parados além do limite.")
        return

    message = "Workloop ViralMind (10min):\n- " + "\n- ".join(lines)
    result = post_room_message(message)
    if result:
        for card in active_cards:
            owner_line = f"@{card['owner']} card parado: `{card['name']}`"
            if owner_line in message:
                _record_reminder(card["key"], now)
        print("Cobrança enviada.")
        return
    raise SystemExit(1)


if __name__ == "__main__":
    main()
