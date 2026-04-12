"""
Watchdog externo - roda como cron job no VPS.
Checa ultimo timestamp de atividade dos agentes no chat.
Se algum agente ficar >30min sem acao, posta alerta no Conselho.

Uso: python3 watchdog.py
Cron: */10 * * * * cd /opt/viralmind/apps/chat && python3 scripts/watchdog.py
"""

import os
import sys
import json
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

API_BASE = "https://viralmind.openclawhg.tech/api/chat"
ROOM_ID = "3ff753fe-4c88-4e6d-8ea6-a8d017d9bfbb"
IDLE_THRESHOLD_MINUTES = 30

# Agents to monitor (Claude Code and Meyer Lansky)
AGENTS = {
    "Claude Code": {
        "id": "39c5cb01-505c-4f02-bbeb-bfc63e77794f",
        "token": os.environ.get("CLAUDE_CHAT_TOKEN", "2oxnf4TFcIy911y65e2XK9ZR-RxzKV9FcEtwX88F_dw"),
    },
    "Meyer Lansky": {
        "id": "b06693e5-a37c-4d23-9fe8-2486de540646",
        "token": os.environ.get("MEYER_CHAT_TOKEN", "lf2Uxu0Hp8OkYClVzrabJYMMhI-uyAmpIjLZ9tZzqNY"),
    },
}

# Use Hugo's token to post watchdog alerts (or a dedicated watchdog token)
WATCHDOG_TOKEN = os.environ.get("WATCHDOG_TOKEN", "2oxnf4TFcIy911y65e2XK9ZR-RxzKV9FcEtwX88F_dw")


def api_get(url, token):
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.URLError as e:
        print(f"API error: {e}", file=sys.stderr)
        return None


def api_post(url, token, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, method="POST", headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.URLError as e:
        print(f"API error: {e}", file=sys.stderr)
        return None


def get_last_message_time(agent_id):
    """Get the timestamp of the agent's last message in the room."""
    url = f"{API_BASE}/rooms/{ROOM_ID}/messages?limit=50"
    data = api_get(url, WATCHDOG_TOKEN)
    if not data or "messages" not in data:
        return None

    for msg in reversed(data["messages"]):
        if msg["sender_id"] == agent_id:
            return datetime.fromisoformat(msg["created_at"].replace("Z", "+00:00"))

    return None


def post_alert(message):
    """Post watchdog alert to the Conselho room."""
    url = f"{API_BASE}/rooms/{ROOM_ID}/messages"
    api_post(url, WATCHDOG_TOKEN, {"content": message})


def main():
    now = datetime.now(timezone.utc)
    idle_agents = []

    for name, info in AGENTS.items():
        last_msg_time = get_last_message_time(info["id"])
        if last_msg_time is None:
            idle_agents.append((name, "sem mensagens encontradas"))
            continue

        idle_minutes = (now - last_msg_time).total_seconds() / 60

        if idle_minutes > IDLE_THRESHOLD_MINUTES:
            idle_agents.append((name, f"idle ha {int(idle_minutes)} min"))

    if idle_agents:
        lines = ["WATCHDOG ALERTA - Agentes inativos detectados:"]
        for name, reason in idle_agents:
            lines.append(f"- {name}: {reason}")
        lines.append(f"\nRegra: nenhum agente pode ficar >{IDLE_THRESHOLD_MINUTES}min sem acao.")
        lines.append("Executem a proxima pendencia do backlog AGORA.")

        alert = "\n".join(lines)
        post_alert(alert)
        print(alert)
    else:
        print(f"[{now.isoformat()}] Todos agentes ativos. OK.")


if __name__ == "__main__":
    main()
