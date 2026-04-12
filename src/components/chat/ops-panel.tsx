"use client"

import { formatDistanceToNowStrict } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Activity, AlertTriangle, CheckCircle2, Clock3, ExternalLink, RefreshCw, ServerCrash, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { OperationalJob, OperationalRuntime } from "@/lib/chat-api"

const BOARD_URL = "https://board.openclawhg.tech"

interface OpsPanelProps {
  jobs: OperationalJob[]
  runtime: OperationalRuntime | null
  loading?: boolean
  error?: string | null
  onRefresh?: () => Promise<void> | void
  roomName?: string
}

function statusVariant(status: OperationalJob["status"]): "default" | "secondary" | "destructive" | "outline" {
  if (status === "done") return "default"
  if (status === "running") return "secondary"
  if (status === "blocked" || status === "escalated") return "destructive"
  return "outline"
}

function statusLabel(status: OperationalJob["status"]): string {
  const map: Record<OperationalJob["status"], string> = {
    pending: "Pendente",
    running: "Em execução",
    done: "Feito",
    blocked: "Bloqueado",
    escalated: "Escalado",
  }
  return map[status]
}

function relativeTime(dateStr?: string | null): string {
  if (!dateStr) return "sem heartbeat"
  return formatDistanceToNowStrict(new Date(dateStr), { addSuffix: true, locale: ptBR })
}

export function OpsPanel({ jobs, runtime, loading, error, onRefresh, roomName }: OpsPanelProps) {
  const openJobs = jobs.filter((job) => job.status !== "done")

  if (loading) {
    return (
      <aside className="flex h-full w-full flex-col border-l border-zinc-800 bg-[#0b0b11]">
        <div className="border-b border-zinc-800 px-4 py-3">
          <Skeleton className="h-5 w-36" />
        </div>
        <div className="space-y-3 p-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
      </aside>
    )
  }

  return (
    <aside className="flex h-full w-full flex-col border-l border-zinc-800 bg-[#0b0b11]">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">Operações</h3>
          <p className="text-[11px] text-zinc-500">{roomName ? `Estado paralelo de ${roomName}` : "Jobs e runtime fora do feed"}</p>
        </div>
        <div className="flex items-center gap-2">
          <a href={BOARD_URL} target="_blank" rel="noreferrer" className="text-zinc-500 hover:text-zinc-200">
            <ExternalLink className="h-4 w-4" />
          </a>
          <Button variant="ghost" size="icon-sm" onClick={() => onRefresh?.()} className="text-zinc-500 hover:text-zinc-200">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {error && (
          <div className="rounded-2xl border border-red-800/60 bg-red-950/40 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {runtime?.degraded ? (
                <ServerCrash className="h-4 w-4 text-red-400" />
              ) : (
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
              )}
              <span className="text-sm font-medium text-zinc-100">Runtime</span>
            </div>
            <Badge variant={runtime?.degraded ? "destructive" : "default"}>
              {runtime?.degraded ? "degradado" : "saudável"}
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-zinc-950/70 p-3">
              <div className="flex items-center gap-2 text-zinc-400">
                <Activity className="h-3.5 w-3.5" />
                <span className="text-[11px] uppercase tracking-wide">Gateway</span>
              </div>
              <p className={cn("mt-1 text-sm font-medium", runtime?.gateway_ok ? "text-emerald-300" : "text-red-300")}>
                {runtime?.gateway_ok ? "Conectado" : "Falhando"}
              </p>
            </div>
            <div className="rounded-xl bg-zinc-950/70 p-3">
              <div className="flex items-center gap-2 text-zinc-400">
                <Clock3 className="h-3.5 w-3.5" />
                <span className="text-[11px] uppercase tracking-wide">Fila</span>
              </div>
              <p className={cn("mt-1 text-sm font-medium", runtime?.queue_alert ? "text-amber-300" : "text-zinc-100")}>
                {runtime?.total_pending_notifications ?? 0} pendências
              </p>
            </div>
            <div className="rounded-xl bg-zinc-950/70 p-3">
              <div className="flex items-center gap-2 text-zinc-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span className="text-[11px] uppercase tracking-wide">Crons</span>
              </div>
              <p className={cn("mt-1 text-sm font-medium", runtime?.cron_alert ? "text-amber-300" : "text-zinc-100")}>
                {runtime?.cron_overview?.error_jobs ?? 0} erro(s)
              </p>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {(runtime?.agents || []).map((agent) => (
              <div key={agent.id} className="flex items-center justify-between rounded-xl bg-zinc-950/70 px-3 py-2">
                <div>
                  <p className="text-sm text-zinc-200">{agent.name}</p>
                  <p className="text-[11px] text-zinc-500">
                    {relativeTime(agent.last_seen_at)} • {agent.pending_notifications} pendência(s)
                  </p>
                </div>
                <Badge variant={agent.is_stale ? "destructive" : "secondary"}>
                  {agent.is_stale ? "stale" : "ok"}
                </Badge>
              </div>
            ))}
          </div>

          {(runtime?.cron_overview?.jobs?.length || 0) > 0 && (
            <div className="mt-3 rounded-xl border border-amber-800/40 bg-amber-950/20 p-3">
              <p className="text-[11px] uppercase tracking-wide text-amber-300">Crons com falha</p>
              <div className="mt-2 space-y-2">
                {runtime?.cron_overview.jobs.map((job) => (
                  <div key={job.id || job.name} className="rounded-lg bg-zinc-950/70 px-3 py-2">
                    <p className="text-sm text-zinc-100">{job.name}</p>
                    <p className="text-[11px] text-zinc-500">
                      {job.model || "modelo ausente"} • {job.consecutive_errors} erro(s)
                    </p>
                    {job.last_error && <p className="mt-1 text-xs text-amber-100">{job.last_error}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-cyan-400" />
              <span className="text-sm font-medium text-zinc-100">Jobs da sala</span>
            </div>
            <Badge variant="outline">{openJobs.length} abertos</Badge>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              ["pending", runtime?.jobs_overview?.counts?.pending || 0],
              ["running", runtime?.jobs_overview?.counts?.running || 0],
              ["blocked", runtime?.jobs_overview?.counts?.blocked || 0],
              ["done", runtime?.jobs_overview?.counts?.done || 0],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-zinc-950/70 p-2">
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
                <p className="mt-1 text-sm font-semibold text-zinc-100">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            {jobs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-800 px-3 py-5 text-center text-sm text-zinc-500">
                Nenhum job operacional nesta sala ainda.
              </div>
            ) : (
              jobs.map((job) => (
                <article key={job.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-medium text-zinc-100">{job.title}</h4>
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        {job.owner} • {relativeTime(job.updated_at)} • {job.tool_hint}
                      </p>
                    </div>
                    <Badge variant={statusVariant(job.status)}>{statusLabel(job.status)}</Badge>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-zinc-500">Solicitação</p>
                      <p className="mt-1 text-zinc-300">{job.request}</p>
                    </div>

                    {(job.latest?.action || job.latest?.evidence || job.latest?.block) && (
                      <div className="rounded-xl bg-zinc-900/80 p-3">
                        {job.latest?.action && (
                          <p className="text-zinc-200">
                            <span className="text-zinc-500">Ação:</span> {job.latest.action}
                          </p>
                        )}
                        {job.latest?.evidence && (
                          <p className="mt-1 text-emerald-200">
                            <span className="text-emerald-400">Evidência:</span> {job.latest.evidence}
                          </p>
                        )}
                        {job.latest?.block && (
                          <p className="mt-1 text-red-200">
                            <span className="text-red-400">Bloqueio:</span> {job.latest.block}
                          </p>
                        )}
                        {job.latest?.next_step && (
                          <p className="mt-1 text-amber-200">
                            <span className="text-amber-400">Próximo:</span> {job.latest.next_step}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        {runtime?.degraded && (
          <section className="rounded-2xl border border-amber-800/60 bg-amber-950/30 p-4">
            <div className="flex items-center gap-2 text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Atenção operacional</span>
            </div>
            <p className="mt-2 text-sm text-amber-100">
              O runtime está degradado. O feed continua limpo, mas o estado real está sendo acompanhado pelo Control Tower.
            </p>
          </section>
        )}
      </div>
    </aside>
  )
}
