"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Bot,
  Plus,
  Copy,
  Check,
  Users,
  MessageSquare,
  ArrowLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { AgentAvatar } from "@/components/chat/agent-avatar"
import { chatApi, type Agent, type Room } from "@/lib/chat-api"

const agentTypes: { value: Agent['type']; label: string; color: string }[] = [
  { value: "human", label: "Humano", color: "bg-emerald-500" },
  { value: "claude", label: "Claude", color: "bg-purple-500" },
  { value: "telegram", label: "Telegram", color: "bg-blue-500" },
  { value: "webhook", label: "Webhook", color: "bg-amber-500" },
]

export default function AdminPage() {
  const router = useRouter()
  const [agents, setAgents] = useState<Agent[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)

  // Create agent state
  const [createAgentOpen, setCreateAgentOpen] = useState(false)
  const [agentName, setAgentName] = useState("")
  const [agentType, setAgentType] = useState<Agent['type']>("claude")
  const [agentAvatar, setAgentAvatar] = useState("")
  const [creatingAgent, setCreatingAgent] = useState(false)
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [copiedToken, setCopiedToken] = useState(false)

  // Create room state
  const [createRoomOpen, setCreateRoomOpen] = useState(false)
  const [roomName, setRoomName] = useState("")
  const [roomDesc, setRoomDesc] = useState("")
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [creatingRoom, setCreatingRoom] = useState(false)

  // Load data
  useEffect(() => {
    async function load() {
      try {
        const [agentsData, roomsData] = await Promise.all([
          chatApi.getAgents(),
          chatApi.getRooms(),
        ])
        setAgents(agentsData)
        setRooms(roomsData)
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleCreateAgent(e: React.FormEvent) {
    e.preventDefault()
    if (!agentName.trim()) return
    setCreatingAgent(true)

    try {
      const result = await chatApi.createAgent({
        name: agentName.trim(),
        type: agentType,
        avatar_url: agentAvatar.trim() || undefined,
      })
      setAgents((prev) => [...prev, result])
      setCreatedToken(result.token)
      setAgentName("")
      setAgentAvatar("")
    } catch {
      // silent
    } finally {
      setCreatingAgent(false)
    }
  }

  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault()
    if (!roomName.trim()) return
    setCreatingRoom(true)

    try {
      const room = await chatApi.createRoom({
        name: roomName.trim(),
        description: roomDesc.trim() || undefined,
        member_ids: selectedMembers.length > 0 ? selectedMembers : undefined,
      })
      setRooms((prev) => [...prev, room])
      setCreateRoomOpen(false)
      setRoomName("")
      setRoomDesc("")
      setSelectedMembers([])
    } catch {
      // silent
    } finally {
      setCreatingRoom(false)
    }
  }

  function toggleMember(agentId: string) {
    setSelectedMembers((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId]
    )
  }

  async function copyToken() {
    if (!createdToken) return
    await navigator.clipboard.writeText(createdToken)
    setCopiedToken(true)
    setTimeout(() => setCopiedToken(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col p-6 gap-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <Skeleton className="h-6 w-24" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
          <div className="space-y-3">
            <Skeleton className="h-6 w-24" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-900 px-4 py-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => router.push("/")}
          className="text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-sm font-semibold text-zinc-100">Administracao</h1>
      </div>

      <div className="p-4 md:p-6 space-y-8">
        {/* Agents section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-violet-400" />
              <h2 className="text-base font-semibold text-zinc-100">Agentes</h2>
              <Badge variant="secondary">{agents.length}</Badge>
            </div>
            <Button size="sm" onClick={() => setCreateAgentOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Novo Agente
            </Button>
          </div>

          {agents.length === 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center">
              <Bot className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-sm text-zinc-500">Nenhum agente criado</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3"
                >
                  <AgentAvatar agent={agent} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">
                      {agent.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge
                        variant="outline"
                        className={cn("text-[10px]", {
                          "border-emerald-600 text-emerald-400": agent.type === "human",
                          "border-purple-600 text-purple-400": agent.type === "claude",
                          "border-blue-600 text-blue-400": agent.type === "telegram",
                          "border-amber-600 text-amber-400": agent.type === "webhook",
                        })}
                      >
                        {agent.type}
                      </Badge>
                      <span
                        className={cn("text-[10px]", {
                          "text-emerald-500": agent.status === "online",
                          "text-zinc-600": agent.status === "offline",
                        })}
                      >
                        {agent.status === "online" ? "Online" : "Offline"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <Separator className="bg-zinc-800" />

        {/* Rooms section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-violet-400" />
              <h2 className="text-base font-semibold text-zinc-100">Salas</h2>
              <Badge variant="secondary">{rooms.length}</Badge>
            </div>
            <Button size="sm" onClick={() => setCreateRoomOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Nova Sala
            </Button>
          </div>

          {rooms.length === 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center">
              <MessageSquare className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-sm text-zinc-500">Nenhuma sala criada</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {rooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => router.push(`/rooms/${room.id}`)}
                  className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-left hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                    <MessageSquare className="h-4 w-4 text-zinc-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">
                      {room.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Users className="h-3 w-3 text-zinc-600" />
                      <span className="text-[11px] text-zinc-500">
                        {(room as any).member_count ?? (room.members || []).length} membro{((room as any).member_count ?? (room.members || []).length) !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Create Agent Dialog */}
      <Dialog open={createAgentOpen} onOpenChange={(open) => {
        setCreateAgentOpen(open)
        if (!open) {
          setCreatedToken(null)
          setCopiedToken(false)
        }
      }}>
        <DialogHeader>
          <DialogTitle>
            {createdToken ? "Agente Criado" : "Novo Agente"}
          </DialogTitle>
          {createdToken && (
            <DialogDescription>
              Copie o token agora. Ele nao sera exibido novamente.
            </DialogDescription>
          )}
        </DialogHeader>

        {createdToken ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-zinc-800 p-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Token</p>
              <div className="flex items-center gap-2">
                <code className="text-xs text-emerald-400 font-mono break-all flex-1">
                  {createdToken}
                </code>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={copyToken}
                  className="shrink-0"
                >
                  {copiedToken ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-zinc-400" />
                  )}
                </Button>
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                setCreateAgentOpen(false)
                setCreatedToken(null)
              }}
            >
              Fechar
            </Button>
          </div>
        ) : (
          <form onSubmit={handleCreateAgent} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-zinc-300">Nome</label>
              <Input
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="Ex: Claude Pipeline"
                required
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-zinc-300">Tipo</label>
              <div className="grid grid-cols-2 gap-2">
                {agentTypes.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setAgentType(t.value)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                      agentType === t.value
                        ? "border-violet-600 bg-violet-600/10 text-zinc-100"
                        : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
                    )}
                  >
                    <span className={cn("h-2.5 w-2.5 rounded-full", t.color)} />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-zinc-300">
                Avatar URL <span className="text-zinc-600">(opcional)</span>
              </label>
              <Input
                value={agentAvatar}
                onChange={(e) => setAgentAvatar(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="flex justify-end gap-2 mt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreateAgentOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={creatingAgent || !agentName.trim()}>
                {creatingAgent ? "Criando..." : "Criar Agente"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* Create Room Dialog */}
      <Dialog open={createRoomOpen} onOpenChange={setCreateRoomOpen}>
        <DialogHeader>
          <DialogTitle>Nova Sala</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreateRoom} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-zinc-300">Nome</label>
            <Input
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Ex: Pipeline de Videos"
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-zinc-300">
              Descricao <span className="text-zinc-600">(opcional)</span>
            </label>
            <Input
              value={roomDesc}
              onChange={(e) => setRoomDesc(e.target.value)}
              placeholder="Descricao da sala..."
            />
          </div>

          {agents.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-zinc-300">Membros</label>
              <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto rounded-lg border border-zinc-700 p-2">
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => toggleMember(agent.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                      selectedMembers.includes(agent.id)
                        ? "bg-violet-600/10 text-zinc-100"
                        : "text-zinc-400 hover:bg-zinc-800"
                    )}
                  >
                    <div
                      className={cn(
                        "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                        selectedMembers.includes(agent.id)
                          ? "border-violet-500 bg-violet-600"
                          : "border-zinc-600"
                      )}
                    >
                      {selectedMembers.includes(agent.id) && (
                        <Check className="h-3 w-3 text-white" />
                      )}
                    </div>
                    <span>{agent.name}</span>
                    <Badge variant="outline" className="text-[10px] ml-auto">
                      {agent.type}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCreateRoomOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={creatingRoom || !roomName.trim()}>
              {creatingRoom ? "Criando..." : "Criar Sala"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
