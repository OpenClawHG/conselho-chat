#!/usr/bin/env python3
"""
Watchdog operacional do Conselho.

- olha para jobs canônicos, não só para mensagens da sala;
- sinaliza job parado, bloqueado ou escalado sem fechamento;
- sincroniza incidentes no Control Tower via Planka;
- posta alerta no Conselho apenas quando houver exceção real.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from hashlib import sha256
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv


API_ROOT = Path("/opt/viralmind/apps/api")
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from services.operational_jobs import (
    STALE_JOB_MINUTES,
    get_jobs_overview,
    list_jobs,
    list_stale_jobs,
    sync_generic_incident,
    sync_operational_knowledge_base,
    _sync_incident_card,
)
from services.backlog_orchestrator import (
    activate_next_backlog_items,
    DEFAULT_OWNER_ORDER,
    list_backlog_items,
    list_overdue_activated_items,
    list_actionable_backlog_items,
    reactivate_overdue_backlog_items,
    sync_backlog_from_room,
)
from services.operational_runtime import get_runtime_health


load_dotenv("/root/.openclaw/.env", override=False)
load_dotenv("/opt/viralmind/apps/api/.env", override=False)

API_BASE = os.getenv("CHAT_AGENT_API_BASE", "http://127.0.0.1:8000").rstrip("/") + "/api/chat"
ROOM_ID = os.getenv("CONSELHO_ROOM_ID", "3ff753fe-4c88-4e6d-8ea6-a8d017d9bfbb")
WATCHDOG_TOKEN = os.getenv("WATCHDOG_TOKEN", "").strip()
WATCHDOG_STATE_FILE = Path("/root/.openclaw/workspace/runtime/watchdog_state.json")
OWNER_REMINDER_MINUTES = int(os.getenv("CONSELHO_OWNER_REMINDER_MINUTES", "30"))


def api_post(url: str, token: str, data: dict) -> dict | None:
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
    if not WATCHDOG_TOKEN:
        print("WATCHDOG_TOKEN ausente; alerta não enviado", file=sys.stderr)
        return None
    url = f"{API_BASE}/rooms/{ROOM_ID}/messages"
    return api_post(url, WATCHDOG_TOKEN, {"content": message})


def post_alert(message: str) -> None:
    post_room_message(message)


def _load_watchdog_state() -> dict:
    try:
        return json.loads(WATCHDOG_STATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save_watchdog_state(payload: dict) -> None:
    WATCHDOG_STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    WATCHDOG_STATE_FILE.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _build_owner_action_lines(
    *,
    active_jobs: list[dict] | None = None,
    allowed_owners: set[str] | None = None,
    limit_per_owner: int = 2,
) -> list[str]:
    grouped = list_actionable_backlog_items(limit_per_owner=limit_per_owner)
    active_by_owner: dict[str, int] = {}
    for job in active_jobs or []:
        owner = (job.get("owner") or "").strip()
        if not owner:
            continue
        active_by_owner[owner] = active_by_owner.get(owner, 0) + 1
    lines: list[str] = []
    for owner in ("Claude Code", "Meyer Lansky"):
        if allowed_owners is not None and owner not in allowed_owners:
            continue
        if active_by_owner.get(owner, 0) > 0:
            continue
        items = grouped.get(owner) or []
        if not items:
            continue
        first = items[0]
        rest = items[1:]
        action = f"@{owner}: executar `{first.get('title')}`"
        if rest:
            action += " | depois: " + " ; ".join(f"`{item.get('title')}`" for item in rest)
        lines.append(action)
    return lines


def _allowed_owners_for_workloop(runtime: dict, stale_jobs: list[dict]) -> set[str]:
    blocked = set(runtime.get("stale_agents") or [])
    for job in stale_jobs:
        owner = (job.get("owner") or "").strip()
        if owner:
            blocked.add(owner)
    return {owner for owner in DEFAULT_OWNER_ORDER if owner not in blocked}


def _owner_action_digest(lines: list[str]) -> str:
    return sha256("\n".join(lines).encode("utf-8")).hexdigest()


def _should_post_owner_charge(
    owner_action_lines: list[str],
    *,
    stale_jobs: list[dict],
    runtime_alerts: list[str],
    activated_items: list[dict],
    reactivated_items: list[dict],
    overdue_backlog: list[dict],
    now: datetime,
) -> bool:
    if not owner_action_lines:
        return False
    if runtime_alerts or stale_jobs or activated_items or reactivated_items or overdue_backlog:
        return True

    state = _load_watchdog_state()
    current_digest = _owner_action_digest(owner_action_lines)
    previous_digest = state.get("last_owner_digest")
    previous_posted = state.get("last_owner_charge_at")
    if previous_digest != current_digest:
        return True
    if not previous_posted:
        return True
    try:
        previous_dt = datetime.fromisoformat(previous_posted.replace("Z", "+00:00"))
    except Exception:
        return True
    elapsed_seconds = (now - previous_dt).total_seconds()
    return elapsed_seconds >= OWNER_REMINDER_MINUTES * 60


def _record_owner_charge(owner_action_lines: list[str], now: datetime) -> None:
    if not owner_action_lines:
        return
    state = _load_watchdog_state()
    state["last_owner_digest"] = _owner_action_digest(owner_action_lines)
    state["last_owner_charge_at"] = now.replace(microsecond=0).isoformat().replace("+00:00", "Z")
    _save_watchdog_state(state)


def main() -> None:
    now = datetime.now(timezone.utc)
    sync_operational_knowledge_base()
    sync_backlog_from_room(ROOM_ID)
    overview = get_jobs_overview()
    stale_jobs = list_stale_jobs()
    active_jobs = [job for job in list_jobs() if job.get("status") in {"pending", "running"}]
    runtime = get_runtime_health()
    runtime_alerts: list[str] = []

    if not runtime.get("gateway_ok"):
        reason = runtime.get("gateway_error") or "gateway indisponível"
        runtime_alerts.append(f"Gateway OpenClaw indisponível: {reason}")
        sync_generic_incident(
            incident_key="runtime-gateway",
            title="Runtime: gateway OpenClaw indisponível",
            reason=reason,
            state="blocked",
            details=[f"generated_at={runtime.get('generated_at')}"],
        )
    else:
        sync_generic_incident(
            incident_key="runtime-gateway",
            title="Runtime: gateway OpenClaw indisponível",
            reason="gateway saudável",
            state="done",
            details=[f"generated_at={runtime.get('generated_at')}"],
            create_if_missing=False,
        )

    if runtime.get("queue_alert"):
        pending = runtime.get("total_pending_notifications", 0)
        runtime_alerts.append(f"Fila pendente acumulada: {pending}")
        sync_generic_incident(
            incident_key="runtime-queue",
            title="Runtime: fila pendente acumulada",
            reason=f"{pending} notificações pendentes",
            state="running",
            details=[f"threshold={os.getenv('CONSELHO_QUEUE_ALERT_THRESHOLD', '5')}"],
        )
    else:
        sync_generic_incident(
            incident_key="runtime-queue",
            title="Runtime: fila pendente acumulada",
            reason="fila saudável",
            state="done",
            details=[f"threshold={os.getenv('CONSELHO_QUEUE_ALERT_THRESHOLD', '5')}"],
            create_if_missing=False,
        )

    for agent_name in runtime.get("stale_agents") or []:
        runtime_alerts.append(f"Agente sem heartbeat recente: {agent_name}")
        sync_generic_incident(
            incident_key=f"runtime-agent-{agent_name.lower().replace(' ', '-')}",
            title=f"Runtime: agente sem heartbeat - {agent_name}",
            reason=f"{agent_name} sem last_seen recente",
            state="blocked",
        )

    cron_overview = runtime.get("cron_overview") or {}
    cron_error_names = set(cron_overview.get("error_names") or [])
    for cron_job in cron_overview.get("jobs") or []:
        name = cron_job.get("name") or "cron-sem-nome"
        reason = cron_job.get("last_error") or "cron em erro"
        runtime_alerts.append(f"Cron em erro: {name}")
        sync_generic_incident(
            incident_key=f"runtime-cron-{name.lower().replace(' ', '-')}",
            title=f"Runtime: cron em erro - {name}",
            reason=reason,
            state="blocked",
            details=[
                f"model={cron_job.get('model') or 'desconhecido'}",
                f"consecutive_errors={cron_job.get('consecutive_errors', 0)}",
            ],
        )
    for cron_name in cron_overview.get("all_names") or []:
        if cron_name in cron_error_names:
            continue
        sync_generic_incident(
            incident_key=f"runtime-cron-{cron_name.lower().replace(' ', '-')}",
            title=f"Runtime: cron em erro - {cron_name}",
            reason="cron saudável",
            state="done",
            details=["status=ok"],
            create_if_missing=False,
        )

    overdue_backlog = list_overdue_activated_items()
    overdue_ids = {item["id"] for item in overdue_backlog}
    for item in overdue_backlog:
        reason = f"backlog ativado sem fechamento há mais de {os.getenv('CONSELHO_BACKLOG_STALE_MINUTES', '20')} min"
        runtime_alerts.append(f"Backlog sem resposta: {item.get('title')} ({item.get('owner')})")
        sync_generic_incident(
            incident_key=f"backlog-{item['id']}",
            title=f"Backlog sem resposta - {item.get('title')}",
            reason=reason,
            state="running",
            details=[f"owner={item.get('owner')}", f"activated_at={item.get('activated_at')}"],
        )
    for item in list_backlog_items():
        if item.get("id") in overdue_ids:
            continue
        sync_generic_incident(
            incident_key=f"backlog-{item['id']}",
            title=f"Backlog sem resposta - {item.get('title')}",
            reason="backlog reconciliado",
            state="done",
            details=[f"owner={item.get('owner')}", f"status={item.get('status')}"],
            create_if_missing=False,
        )

    allowed_owners = _allowed_owners_for_workloop(runtime, stale_jobs)

    reactivated_items = []
    if allowed_owners and runtime.get("gateway_ok"):
        reactivated_items = reactivate_overdue_backlog_items(
            room_id=ROOM_ID,
            post_message=post_room_message,
            per_owner_limit=1,
            allowed_owners=allowed_owners,
        )

    activated_items = []
    if allowed_owners and runtime.get("gateway_ok"):
        activated_items = activate_next_backlog_items(
            room_id=ROOM_ID,
            post_message=post_room_message,
            per_owner_limit=1,
            allowed_owners=allowed_owners,
        )

    owner_action_lines = _build_owner_action_lines(active_jobs=active_jobs, allowed_owners=allowed_owners)
    should_post_owner_charge = _should_post_owner_charge(
        owner_action_lines,
        stale_jobs=stale_jobs,
        runtime_alerts=runtime_alerts,
        activated_items=activated_items,
        reactivated_items=reactivated_items,
        overdue_backlog=overdue_backlog,
        now=now,
    )

    if not stale_jobs and not runtime_alerts and not reactivated_items and not activated_items and not should_post_owner_charge:
        print(f"[{now.isoformat()}] Watchdog OK. jobs={overview['total_jobs']} stale=0 degraded=0")
        return

    lines = ["WATCHDOG ALERTA - Jobs operacionais sem fechamento detectados:"]
    if stale_jobs:
        for job in stale_jobs:
            latest = job.get("latest") or {}
            reason = latest.get("block") or latest.get("action") or "sem atualização recente"
            lines.append(f"- {job['title']} | status={job['status']} | motivo={reason}")
            _sync_incident_card(job, "new", f"sem atualização há mais de {STALE_JOB_MINUTES} min")
        lines.append("")
        lines.append(f"Regra: nenhum job pode ficar >{STALE_JOB_MINUTES}min em pending/running sem recibo válido.")

    if runtime_alerts:
        if stale_jobs:
            lines.append("")
        lines.append("WATCHDOG ALERTA - Degradação de runtime:")
        for item in runtime_alerts:
            lines.append(f"- {item}")

    if reactivated_items:
        if stale_jobs or runtime_alerts:
            lines.append("")
        lines.append("WATCHDOG AÇÃO - Frentes reativadas:")
        for item in reactivated_items:
            lines.append(f"- owner={item.get('owner')} | tarefa={item.get('title')} | tentativas={item.get('activation_count')}")

    if activated_items:
        if stale_jobs or runtime_alerts or reactivated_items:
            lines.append("")
        lines.append("WATCHDOG AÇÃO - Próximas frentes ativadas:")
        for item in activated_items:
            lines.append(f"- owner={item.get('owner')} | tarefa={item.get('title')}")

    if owner_action_lines and should_post_owner_charge:
        if stale_jobs or runtime_alerts or reactivated_items or activated_items:
            lines.append("")
        lines.append("WATCHDOG COBRANÇA - O que falta executar:")
        for item in owner_action_lines:
            lines.append(f"- {item}")

    alert = "\n".join(lines)
    if stale_jobs or runtime_alerts or should_post_owner_charge:
        post_alert(alert)
        if should_post_owner_charge:
            _record_owner_charge(owner_action_lines, now)
    print(alert)


if __name__ == "__main__":
    main()
