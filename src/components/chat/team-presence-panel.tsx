"use client"

import { formatDistanceToNowStrict } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Activity, AlertCircle, ArrowRight, Clock3, PauseCircle } from "lucide-react"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { Room, RuntimeAgentActivity, RuntimeAgentStatus } from "@/lib/chat-api"

interface TeamPresencePanelProps {
  room: Room
  loading?: boolean
  error?: string | null
  agentActivity?: RuntimeAgentActivity[]
  agentStatus?: RuntimeAgentStatus[]
}

type PresenceState = "working" | "blocked" | "idle"

interface PresenceMember {
  id: string
  name: string
  avatarUrl?: string
  state: PresenceState
  subtitle: string
  nextTask?: string | null
  activeJobs: number
  blockedJobs: number
  idleMinutes?: number | null
}

function relativeTime(dateStr?: string | null): string {
  if (!dateStr) return "sem evidência recente"
  return formatDistanceToNowStrict(new Date(dateStr), {
    addSuffix: true,
    locale: ptBR,
  })
}

function resolveState(activity?: RuntimeAgentActivity): PresenceState {
  if (!activity) return "idle"
  if (activity.blocked_jobs > 0 && activity.active_jobs === 0) return "blocked"
  if (activity.active_jobs > 0) return "working"
  if (activity.has_waiting_work && activity.is_idle) return "blocked"
  return "idle"
}

function stateLabel(state: PresenceState): string {
  if (state === "working") return "working"
  if (state === "blocked") return "blocked"
  return "idle"
}

function stateBadgeClass(state: PresenceState): string {
  if (state === "working") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
  if (state === "blocked") return "border-amber-500/30 bg-amber-500/10 text-amber-200"
  return "border-zinc-700 bg-zinc-800/80 text-zinc-300"
}

function stateDotClass(state: PresenceState): string {
  if (state === "working") return "bg-emerald-400"
  if (state === "blocked") return "bg-amber-400"
  return "bg-zinc-500"
}

function stateRingClass(state: PresenceState): string {
  if (state === "working") return "ring-emerald-500/30"
  if (state === "blocked") return "ring-amber-500/30"
  return "ring-zinc-700"
}

function buildPresenceMembers(
  room: Room,
  agentActivity: RuntimeAgentActivity[] = [],
  agentStatus: RuntimeAgentStatus[] = [],
): PresenceMember[] {
  const activityByName = new Map(agentActivity.map((item) => [item.name, item]))
  const statusByName = new Map(agentStatus.map((item) => [item.name, item]))

  return (room.members || [])
    .filter((member) => member.agent?.type !== "human")
    .map((member) => {
      const activity = activityByName.get(member.agent.name)
      const status = statusByName.get(member.agent.name)
      const state = resolveState(activity)
      const subtitle = activity
        ? activity.blocked_jobs > 0 && activity.active_jobs === 0
          ? `bloqueado • ${activity.blocked_jobs} frente(s)`
          : activity.active_jobs > 0
            ? `última evidência ${relativeTime(activity.last_evidence_at || activity.last_useful_at)}`
            : status?.last_seen_at
              ? `último heartbeat ${relativeTime(status.last_seen_at)}`
              : "sem atividade recente"
        : status?.last_seen_at
          ? `último heartbeat ${relativeTime(status.last_seen_at)}`
          : "sem atividade recente"

      return {
        id: member.agent_id,
        name: member.agent.name,
        avatarUrl: member.agent.avatar_url,
        state,
        subtitle,
        nextTask: activity?.next_task || null,
        activeJobs: activity?.active_jobs || 0,
        blockedJobs: activity?.blocked_jobs || 0,
        idleMinutes: activity?.idle_minutes ?? null,
      }
    })
    .sort((a, b) => {
      const order: Record<PresenceState, number> = { working: 0, blocked: 1, idle: 2 }
      return order[a.state] - order[b.state] || a.name.localeCompare(b.name)
    })
}

export function TeamPresencePanel({
  room,
  loading,
  error,
  agentActivity,
  agentStatus,
}: TeamPresencePanelProps) {
  const members = buildPresenceMembers(room, agentActivity, agentStatus)
  const workingCount = members.filter((member) => member.state === "working").length
  const blockedCount = members.filter((member) => member.state === "blocked").length

  if (loading) {
    return (
      <aside className="flex h-full w-full flex-col border-l border-zinc-800 bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.08),_transparent_34%),_#09090b]">
        <div className="border-b border-zinc-800 px-4 py-4">
          <Skeleton className="h-5 w-36" />
        </div>
        <div className="space-y-3 p-4">
          <Skeleton className="h-24 w-full rounded-3xl" />
          <Skeleton className="h-24 w-full rounded-3xl" />
          <Skeleton className="h-24 w-full rounded-3xl" />
        </div>
      </aside>
    )
  }

  return (
    <aside className="flex h-full w-full flex-col border-l border-zinc-800 bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.08),_transparent_34%),_#09090b]">
      <div className="border-b border-zinc-800 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Live Crew</p>
            <h3 className="mt-1 text-sm font-semibold text-zinc-100">Equipe da sala</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Quem está trabalhando agora, quem travou e qual a próxima frente.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-right">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">agora</p>
            <p className="mt-1 text-sm font-semibold text-zinc-100">
              {workingCount} working
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-300/80">Working</p>
            <p className="mt-1 text-base font-semibold text-emerald-100">{workingCount}</p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-amber-300/80">Blocked</p>
            <p className="mt-1 text-base font-semibold text-amber-100">{blockedCount}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {error ? (
          <div className="rounded-3xl border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {members.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/50 px-4 py-6 text-sm text-zinc-500">
            Nenhum agente operacional nesta sala.
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <article
                key={member.id}
                className={cn(
                  "rounded-3xl border bg-zinc-900/70 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-sm",
                  member.state === "working" && "border-emerald-500/20",
                  member.state === "blocked" && "border-amber-500/20",
                  member.state === "idle" && "border-zinc-800",
                )}
              >
                <div className="flex items-start gap-3">
                  <Avatar
                    src={member.avatarUrl}
                    fallback={member.name}
                    size="md"
                    borderColor={stateRingClass(member.state)}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn("h-2.5 w-2.5 rounded-full", stateDotClass(member.state))} />
                          <p className="truncate text-sm font-semibold text-zinc-100">{member.name}</p>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">{member.subtitle}</p>
                      </div>
                      <Badge className={cn("border px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em]", stateBadgeClass(member.state))}>
                        {stateLabel(member.state)}
                      </Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="rounded-2xl bg-zinc-950/80 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">ativos</p>
                        <p className="mt-1 text-sm font-semibold text-zinc-100">{member.activeJobs}</p>
                      </div>
                      <div className="rounded-2xl bg-zinc-950/80 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">bloq.</p>
                        <p className="mt-1 text-sm font-semibold text-zinc-100">{member.blockedJobs}</p>
                      </div>
                      <div className="rounded-2xl bg-zinc-950/80 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">idle</p>
                        <p className="mt-1 text-sm font-semibold text-zinc-100">{member.idleMinutes ?? 0}m</p>
                      </div>
                    </div>

                    {member.nextTask ? (
                      <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 px-3 py-3">
                        <div className="flex items-start gap-2">
                          {member.state === "blocked" ? (
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                          ) : member.state === "working" ? (
                            <Activity className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                          ) : (
                            <PauseCircle className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                          )}
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">próxima frente</p>
                            <p className="mt-1 text-sm text-zinc-200">{member.nextTask}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-dashed border-zinc-800 px-3 py-3 text-xs text-zinc-500">
                        <Clock3 className="h-4 w-4 shrink-0" />
                        Nenhuma frente atribuída no runtime desta sala.
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="mt-4 rounded-3xl border border-zinc-800 bg-zinc-900/50 px-4 py-4 text-xs text-zinc-500">
          <div className="flex items-center gap-2 text-zinc-400">
            <ArrowRight className="h-3.5 w-3.5" />
            <span>O status `working` aparece quando há job ativo ou evidência recente.</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
