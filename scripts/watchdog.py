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
    list_overdue_activated_items,
    sync_backlog_from_room,
)
from services.operational_runtime import get_runtime_health


load_dotenv("/root/.openclaw/.env", override=False)
load_dotenv("/opt/viralmind/apps/api/.env", override=False)

API_BASE = os.getenv("CHAT_AGENT_API_BASE", "http://127.0.0.1:8000").rstrip("/") + "/api/chat"
ROOM_ID = os.getenv("CONSELHO_ROOM_ID", "3ff753fe-4c88-4e6d-8ea6-a8d017d9bfbb")
WATCHDOG_TOKEN = os.getenv("WATCHDOG_TOKEN", "").strip()


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
        )

    overdue_backlog = list_overdue_activated_items()
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

    activated_items = []
    if not stale_jobs and not runtime.get("degraded") and not active_jobs:
        activated_items = activate_next_backlog_items(
            room_id=ROOM_ID,
            post_message=post_room_message,
            per_owner_limit=1,
        )

    if not stale_jobs and not runtime_alerts and not activated_items:
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

    if activated_items:
        if stale_jobs or runtime_alerts:
            lines.append("")
        lines.append("WATCHDOG AÇÃO - Próximas frentes ativadas:")
        for item in activated_items:
            lines.append(f"- owner={item.get('owner')} | tarefa={item.get('title')}")

    alert = "\n".join(lines)
    if stale_jobs or runtime_alerts:
        post_alert(alert)
    print(alert)


if __name__ == "__main__":
    main()
