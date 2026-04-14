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
from services.viralmind_delivery_sync import load_delivery_state
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
IDLE_MINUTES = int(os.getenv("VIRALMIND_IDLE_MINUTES", "20"))
REMINDER_COOLDOWN_MINUTES = int(os.getenv("VIRALMIND_REMINDER_COOLDOWN_MINUTES", "40"))
FIRST_EVIDENCE_MINUTES = int(os.getenv("VIRALMIND_FIRST_EVIDENCE_MINUTES", "15"))
STATE_FILE = Path("/root/.openclaw/workspace/runtime/viralmind_workloop_state.json")
TRACKED_LISTS = {"Bloqueado", "Em Andamento"}
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


def _parse_iso_like(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def _delivery_entry(card_key: str) -> dict:
    return ((load_delivery_state().get("cards") or {}).get(card_key) or {})


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
                "id": match.get("id"),
                "key": spec["key"],
                "name": spec["name"],
                "owner": spec["owner"],
                "list_name": lists.get(match.get("listId")),
                "artifact_paths": spec.get("artifact_paths") or [],
                "canonical_list_name": spec.get("list_name"),
                "position": match.get("position") or 65536,
                "board_id": board["id"],
            }
        )
    return rows


def _list_id_by_name(board_id: str, list_name: str) -> str:
    client = get_planka_client()
    payload = client.get_board(board_id)
    included = payload.get("included") or {}
    for item in included.get("lists") or []:
        if item.get("type") == "active" and item.get("name") == list_name:
            return item["id"]
    raise RuntimeError(f"Lista {list_name} não encontrada no board {board_id}")


def _move_card_to_list(card: dict, list_name: str) -> None:
    client = get_planka_client()
    list_id = _list_id_by_name(card["board_id"], list_name)
    client.update_card(card["id"], listId=list_id, position=card.get("position") or 65536)


def _artifact_guidance(card: dict) -> str:
    artifact_paths = card.get("artifact_paths") or []
    if not artifact_paths:
        return "Entregue a primeira evidência verificável agora."
    return (
        "Primeira evidência esperada agora: commit compartilhado tocando "
        + ", ".join(f"`{path}`" for path in artifact_paths)
        + "."
    )


def _dispatch_ready_cards(cards: list[dict], now: datetime) -> list[str]:
    dispatches: list[str] = []
    state = _load_state()
    owners = sorted({card["owner"] for card in cards})
    for owner in owners:
        owner_cards = [card for card in cards if card["owner"] == owner]
        if any(card["list_name"] in {"Em Andamento", "Bloqueado"} for card in owner_cards):
            continue
        prioritized = [card for card in owner_cards if card["list_name"] == "Priorizado"]
        if not prioritized:
            continue
        card = prioritized[0]
        _move_card_to_list(card, "Em Andamento")
        _record_reminder(card["key"], now)
        card_state = state.setdefault("cards", {}).setdefault(card["key"], {})
        card_state["dispatch_at"] = now.replace(microsecond=0).isoformat().replace("+00:00", "Z")
        dispatches.append(
            f"@{owner} auto-dispatch: `{card['name']}` -> `Em Andamento`. "
            f"Não use prazo humano largo. {_artifact_guidance(card)}"
        )
        card["list_name"] = "Em Andamento"
    if dispatches:
        _save_state(state)
    return dispatches


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
    dispatch_lines = _dispatch_ready_cards(cards, now)
    tracked_cards = [
        card
        for card in cards
        if card.get("list_name") in TRACKED_LISTS and card.get("canonical_list_name") != "Gestão"
    ]

    lines_by_owner: dict[str, list[str]] = {}
    for card in tracked_cards:
        owner = card["owner"]
        last_update = _latest_owner_card_update(owner, card["name"])
        last_evidence, evidence_excerpt = _latest_owner_card_evidence_update(owner, card["name"])
        delivery = _delivery_entry(card["key"])
        delivery_state = (delivery.get("state") or "").strip()
        verified_at = _parse_iso_like(delivery.get("verified_at") or delivery.get("claim_created_at"))
        workloop_state = (_load_state().get("cards") or {}).get(card["key"], {})
        dispatch_at = _parse_iso_like(workloop_state.get("dispatch_at"))

        missing_first_evidence = (
            card.get("list_name") == "Em Andamento"
            and delivery_state not in {"verified_progress", "verified_done"}
            and dispatch_at is not None
            and (now - dispatch_at) >= timedelta(minutes=FIRST_EVIDENCE_MINUTES)
        )
        stale_verified_evidence = (
            verified_at is not None
            and card.get("list_name") == "Em Andamento"
            and (now - verified_at) >= timedelta(minutes=IDLE_MINUTES)
        )
        idle = missing_first_evidence or stale_verified_evidence or (last_evidence is None or (now - last_evidence) >= timedelta(minutes=IDLE_MINUTES))
        if not idle:
            continue
        freshness_marker = last_evidence or last_update
        if not _should_remind(card["key"], freshness_marker, now):
            continue
        if missing_first_evidence:
            reason = f"card em andamento sem primeira evidência verificável há ~{FIRST_EVIDENCE_MINUTES}+min desde o dispatch"
        elif stale_verified_evidence:
            reason = f"última evidência verificável há ~{int((now - verified_at).total_seconds() / 60)}min"
        else:
            reason = _build_idle_reason(owner, last_update=last_update, last_evidence=last_evidence)
        guidance = (
            "Responder agora com: `Card`, `Status`, `Evidência`, `Próximo passo`, `Bloqueio`. "
            f"Não use prazo humano largo; entregue a próxima evidência verificável em até {FIRST_EVIDENCE_MINUTES}min."
        )
        artifact_paths = card.get("artifact_paths") or []
        if artifact_paths:
            guidance += " Evidência preferida: commit compartilhado tocando " + ", ".join(f"`{path}`" for path in artifact_paths) + "."
        if evidence_excerpt:
            guidance += f" Última evidência vista: {evidence_excerpt}"
        lines_by_owner.setdefault(owner, []).append(
            f"@{owner} card parado: `{card['name']}` | lista: `{card['list_name']}` | motivo observado: {reason}. "
            f"{guidance}"
        )

    dispatch_by_owner: dict[str, list[str]] = {}
    for line in dispatch_lines:
        owner_match = re.match(r"@([^\s]+)\s+", line)
        owner = owner_match.group(1) if owner_match else "room"
        dispatch_by_owner.setdefault(owner, []).append(line)

    if not lines_by_owner and not dispatch_by_owner:
        print("ViralMind workloop OK: sem owners parados além do limite.")
        return

    posted_any = False
    owners = sorted(set(dispatch_by_owner) | set(lines_by_owner))
    for owner in owners:
        sections: list[str] = []
        owner_dispatches = dispatch_by_owner.get(owner) or []
        owner_lines = lines_by_owner.get(owner) or []
        if owner_dispatches:
            sections.append("Dispatch:\n- " + "\n- ".join(owner_dispatches))
        if owner_lines:
            sections.append(f"Workloop ViralMind ({IDLE_MINUTES}min):\n- " + "\n- ".join(owner_lines))
        if not sections:
            continue
        message = "\n\n".join(sections)
        result = post_room_message(message)
        if result:
            posted_any = True
            for card in tracked_cards:
                owner_line = f"@{card['owner']} card parado: `{card['name']}`"
                if owner_line in message:
                    _record_reminder(card["key"], now)
    if posted_any:
        print("Cobrança enviada.")
        return
    raise SystemExit(1)


if __name__ == "__main__":
    main()
