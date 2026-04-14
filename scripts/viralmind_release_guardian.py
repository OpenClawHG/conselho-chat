#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import subprocess
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv


load_dotenv("/root/.openclaw/.env", override=False)
load_dotenv("/opt/viralmind/apps/api/.env", override=False)

ROOM_ID = os.getenv("VIRALMIND_ROOM_ID", "c091861b-161e-415a-bd79-1b4d559c844b")
API_BASE_URL = os.getenv("CHAT_AGENT_API_BASE", "http://127.0.0.1:8000").rstrip("/")
CODEX_TOKEN = os.getenv("CODEX_AGENT_TOKEN", "").strip()
STATE_FILE = Path("/root/.openclaw/workspace/runtime/viralmind_release_guardian_state.json")


@dataclass
class Target:
    name: str
    repo_path: Path
    branch: str
    service: str
    restart_services: list[str]
    smoke_url: str
    smoke_expect: str
    runtime_paths: tuple[str, ...]


TARGETS = [
    Target(
        name="backend",
        repo_path=Path("/opt/viralmind"),
        branch="main",
        service="viralmind-api.service",
        restart_services=[
            "viralmind-api.service",
            "openclaw-viralmind-ada.service",
            "openclaw-viralmind-edwin.service",
            "openclaw-viralmind-rita.service",
            "openclaw-viralmind-ogilvy.service",
        ],
        smoke_url="http://127.0.0.1:8000/api/health",
        smoke_expect="ok",
        runtime_paths=("apps/api/", "supabase/", "alembic/", "scripts/"),
    ),
    Target(
        name="frontend",
        repo_path=Path("/opt/viralmind/apps/web"),
        branch="main",
        service="viralmind-web.service",
        restart_services=["viralmind-web.service"],
        smoke_url="http://127.0.0.1:3002/login",
        smoke_expect="html",
        runtime_paths=("src/", "public/", "package.json", "package-lock.json", "next.config", "tsconfig"),
    ),
    Target(
        name="chat",
        repo_path=Path("/opt/viralmind/apps/chat"),
        branch="codex/conselho-ops-runtime-sync-20260412",
        service="openclaw-chat.service",
        restart_services=["openclaw-chat.service"],
        smoke_url="http://127.0.0.1:3001/login",
        smoke_expect="html",
        runtime_paths=("src/", "public/", "scripts/", "package.json", "package-lock.json", "next.config", "tsconfig"),
    ),
]


def _load_state() -> dict[str, Any]:
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save_state(payload: dict[str, Any]) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _git(repo: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-C", str(repo), *args],
        text=True,
        capture_output=True,
        check=False,
    )


def _run(*args: str, cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(list(args), text=True, capture_output=True, check=False, cwd=str(cwd) if cwd else None)


def _head_changed_paths(repo: Path) -> list[str]:
    result = _git(repo, "diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD")
    if result.returncode != 0:
        return []
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def _head_has_runtime_changes(target: Target, changed_paths: list[str]) -> bool:
    if not changed_paths:
        return True
    for path in changed_paths:
        if path.startswith("docs/") or path.endswith(".md"):
            continue
        if any(path == prefix or path.startswith(prefix) for prefix in target.runtime_paths):
            return True
    return False


def _needs_node_install(changed_paths: list[str]) -> bool:
    return any(path in {"package.json", "package-lock.json"} for path in changed_paths)


def _build_target(target: Target, changed_paths: list[str]) -> subprocess.CompletedProcess[str] | None:
    if target.name not in {"frontend", "chat"}:
        return None
    if _needs_node_install(changed_paths):
        install = _run("npm", "ci", "--prefer-offline", cwd=target.repo_path)
        if install.returncode != 0:
            return install
    return _run("npm", "run", "build", cwd=target.repo_path)


def _post_room_message(content: str) -> None:
    if not CODEX_TOKEN:
        return
    try:
        with httpx.Client(
            base_url=API_BASE_URL,
            timeout=httpx.Timeout(20.0, connect=5.0),
            headers={"Authorization": f"Bearer {CODEX_TOKEN}"},
        ) as client:
            client.post(
                f"/api/chat/rooms/{ROOM_ID}/messages",
                json={"content": content, "metadata": {"source": "viralmind-release-guardian"}},
            ).raise_for_status()
    except httpx.HTTPError:
        pass


def _service_started_at(service: str) -> datetime | None:
    result = _run("systemctl", "show", "-p", "ExecMainStartTimestamp", service)
    if result.returncode != 0:
        return None
    raw = result.stdout.strip().split("=", 1)[-1].strip()
    if not raw:
        return None
    try:
        return datetime.strptime(raw, "%a %Y-%m-%d %H:%M:%S %Z").replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _service_active(service: str) -> bool:
    result = _run("systemctl", "is-active", service)
    return result.returncode == 0 and result.stdout.strip() == "active"


def _smoke(target: Target) -> tuple[bool, str]:
    last_reason = "smoke nao executado"
    for _ in range(3):
        try:
            response = httpx.get(target.smoke_url, timeout=httpx.Timeout(10.0, connect=3.0))
            body = response.text.lower()
            if response.status_code >= 400:
                last_reason = f"http {response.status_code}"
            elif target.smoke_expect == "ok" and "ok" not in body:
                last_reason = "health body sem ok"
            elif target.smoke_expect == "html" and "<html" not in body and "<!doctype html" not in body:
                last_reason = "resposta sem html"
            else:
                return True, f"http {response.status_code}"
        except httpx.HTTPError as exc:
            last_reason = str(exc)
        time.sleep(2)
    return False, last_reason


def _target_status(target: Target) -> dict[str, Any]:
    _git(target.repo_path, "fetch", "origin", "--prune")
    local = _git(target.repo_path, "rev-parse", "--short", "HEAD").stdout.strip()
    remote = _git(target.repo_path, "rev-parse", "--short", f"origin/{target.branch}").stdout.strip()
    changed_paths = _head_changed_paths(target.repo_path)
    runtime_changed = _head_has_runtime_changes(target, changed_paths)
    raw_status = _git(target.repo_path, "status", "--short").stdout.splitlines()
    relevant_status = [
        line
        for line in raw_status
        if "__pycache__" not in line and not line.endswith(".pyc")
    ]
    dirty = bool(relevant_status)
    commit_date = _git(target.repo_path, "show", "-s", "--format=%cI", "HEAD").stdout.strip()
    commit_at = datetime.fromisoformat(commit_date.replace("Z", "+00:00")) if commit_date else None
    started_at = _service_started_at(target.service)
    active = _service_active(target.service)
    pending_deploy = bool(
        (local and remote and local != remote)
        or (commit_at and started_at and started_at < commit_at and runtime_changed)
        or not active
    )
    return {
        "target": target,
        "local": local,
        "remote": remote,
        "dirty": dirty,
        "active": active,
        "started_at": started_at.isoformat() if started_at else None,
        "commit_at": commit_at.isoformat() if commit_at else None,
        "runtime_changed": runtime_changed,
        "pending_deploy": pending_deploy,
    }


def _deploy_target(status: dict[str, Any]) -> dict[str, Any]:
    target: Target = status["target"]
    repo = target.repo_path
    actions: list[str] = []
    critical: list[str] = []

    if status["dirty"]:
        return {
            "target": target.name,
            "status": "skipped_dirty",
            "actions": [],
            "critical": [f"repo sujo em {repo}"],
        }

    changed_paths = _head_changed_paths(repo)

    if status["local"] != status["remote"]:
        pull = _git(repo, "pull", "--ff-only", "origin", target.branch)
        if pull.returncode != 0:
            return {
                "target": target.name,
                "status": "pull_failed",
                "actions": [],
                "critical": [pull.stderr.strip() or pull.stdout.strip() or "git pull falhou"],
            }
        actions.append(f"pull {target.branch}")
        changed_paths = _head_changed_paths(repo)
        status["runtime_changed"] = _head_has_runtime_changes(target, changed_paths)

    if status["runtime_changed"] and target.name in {"frontend", "chat"}:
        build = _build_target(target, changed_paths)
        if build is not None and build.returncode != 0:
            return {
                "target": target.name,
                "status": "build_failed",
                "actions": actions,
                "critical": [build.stderr.strip() or build.stdout.strip() or "build falhou"],
            }
        actions.append("build")

    if (not status["active"]) or status["runtime_changed"]:
        restart = _run("systemctl", "restart", *target.restart_services)
        if restart.returncode != 0:
            return {
                "target": target.name,
                "status": "restart_failed",
                "actions": actions,
                "critical": [restart.stderr.strip() or restart.stdout.strip() or "restart falhou"],
            }
        actions.append("restart " + ",".join(target.restart_services))
        time.sleep(3)

    ok, smoke_reason = _smoke(target)
    if not ok:
        second_restart = _run("systemctl", "restart", *target.restart_services)
        if second_restart.returncode == 0:
            ok, smoke_reason = _smoke(target)
            actions.append("retry-restart")
        if not ok:
            critical.append(f"smoke falhou: {smoke_reason}")
    else:
        actions.append(f"smoke {smoke_reason}")

    return {
        "target": target.name,
        "status": "ok" if not critical else "critical",
        "actions": actions,
        "critical": critical,
    }


def main() -> None:
    state = _load_state()
    last_signature = state.get("last_signature")
    results = [_deploy_target(_target_status(target)) for target in TARGETS]
    critical = [item for item in results if item["status"] in {"critical", "pull_failed", "restart_failed", "skipped_dirty"}]
    acted = [item for item in results if item["actions"]]
    payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "results": results,
    }
    signature = json.dumps(results, sort_keys=True, ensure_ascii=False)
    if signature != last_signature and (critical or acted):
        lines = ["Release guardian:"]
        for item in results:
            line = f"- `{item['target']}`: {item['status']}"
            if item["actions"]:
                line += f" | ações: {', '.join(item['actions'])}"
            if item["critical"]:
                line += f" | crítico: {'; '.join(item['critical'])}"
            lines.append(line)
        _post_room_message("\n".join(lines))
    state["last_signature"] = signature
    state["last_results"] = payload
    _save_state(state)
    print(json.dumps(payload, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
