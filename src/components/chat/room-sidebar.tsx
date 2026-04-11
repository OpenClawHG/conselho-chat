"use client"

import { useMemo, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { format, isToday, isYesterday } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Plus, Search, MessageSquare, LogOut, ChevronDown, Hash } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { createClient } from "@/lib/supabase"
import type { Room, ChatTree } from "@/lib/chat-api"

interface RoomSidebarProps {
  rooms: Room[]
  tree?: ChatTree
  loading?: boolean
  onCreateRoom: () => void
  onNavigate?: () => void
}

function formatLastMessageTime(dateStr: string): string {
  const date = new Date(dateStr)
  if (isToday(date)) return format(date, "HH:mm")
  if (isYesterday(date)) return "Ontem"
  return format(date, "dd/MM", { locale: ptBR })
}

function splitDiscordPath(roomName: string): { server: string; category: string; channel: string } {
  const parts = roomName.split("/").map((s) => s.trim()).filter(Boolean)
  if (parts.length >= 3) {
    return { server: parts[0], category: parts[1], channel: parts.slice(2).join(" / ") }
  }
  if (parts.length === 2) {
    return { server: parts[0], category: "Geral", channel: parts[1] }
  }
  return { server: "Workspace", category: "Geral", channel: roomName }
}

export function RoomSidebar({ rooms, tree, loading, onCreateRoom, onNavigate }: RoomSidebarProps) {
  const router = useRouter()
  const params = useParams()
  const activeRoomId = params?.roomId as string | undefined
  const [search, setSearch] = useState("")
  const [collapsedServers, setCollapsedServers] = useState<Record<string, boolean>>({})
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({})

  const sourceTree = useMemo(() => {
    if (tree?.servers?.length) {
      const grouped: Record<string, Record<string, Room[]>> = {}
      for (const s of tree.servers) {
        grouped[s.name] = grouped[s.name] || {}
        for (const c of s.categories || []) {
          grouped[s.name][c.name] = (c.channels || []).map((ch) => ({
            id: ch.room_id,
            name: `${s.name} / ${c.name} / ${ch.name}`,
            description: ch.description,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            members: [],
            unread_count: 0,
          } as Room))
        }
      }
      return grouped
    }

    const grouped: Record<string, Record<string, Room[]>> = {}
    for (const room of rooms) {
      const { server, category } = splitDiscordPath(room.name)
      if (!grouped[server]) grouped[server] = {}
      if (!grouped[server][category]) grouped[server][category] = []
      grouped[server][category].push(room)
    }
    return grouped
  }, [rooms, tree])

  const filteredTree = useMemo(() => {
    if (!search.trim()) return sourceTree
    const q = search.toLowerCase()
    const out: Record<string, Record<string, Room[]>> = {}
    for (const [server, categories] of Object.entries(sourceTree)) {
      for (const [category, channels] of Object.entries(categories)) {
        const hit = channels.filter((r) => `${server} ${category} ${r.name} ${r.description || ""}`.toLowerCase().includes(q))
        if (hit.length) {
          if (!out[server]) out[server] = {}
          out[server][category] = hit
        }
      }
    }
    return out
  }, [sourceTree, search])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  function toggleServer(server: string) {
    setCollapsedServers((prev) => ({ ...prev, [server]: !prev[server] }))
  }

  function toggleCategory(server: string, category: string) {
    const key = `${server}::${category}`
    setCollapsedCategories((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="flex h-full flex-col bg-zinc-900">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-violet-500" />
          <h1 className="text-base font-bold text-zinc-100">Conselho</h1>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={onCreateRoom} className="text-zinc-400 hover:text-zinc-200" title="Novo canal">
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={handleLogout} className="text-zinc-400 hover:text-zinc-200" title="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar servidor/canal..." className="h-8 pl-8 text-xs bg-zinc-800 border-zinc-700" />
        </div>
      </div>

      <Separator className="bg-zinc-800" />

      <div className="flex-1 overflow-y-auto py-1">
        {loading ? (
          <div className="flex flex-col gap-1 px-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
                <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2.5 w-36" />
                </div>
              </div>
            ))}
          </div>
        ) : Object.keys(filteredTree).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <MessageSquare className="h-8 w-8 text-zinc-700 mb-2" />
            <p className="text-xs text-zinc-500 text-center">{search ? "Nenhum resultado" : "Nenhum canal ainda"}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 px-2">
            {Object.entries(filteredTree).map(([server, categories]) => {
              const serverCollapsed = !!collapsedServers[server]
              return (
                <div key={server} className="rounded-lg bg-zinc-900/40 border border-zinc-800/60">
                  <button onClick={() => toggleServer(server)} className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-zinc-800/40 rounded-t-lg">
                    <ChevronDown className={cn("h-3.5 w-3.5 text-zinc-500 transition-transform", serverCollapsed && "-rotate-90")} />
                    <span className="text-[11px] uppercase tracking-wide text-zinc-300 font-semibold truncate">{server}</span>
                  </button>

                  {!serverCollapsed && (
                    <div className="pb-1.5">
                      {Object.entries(categories).map(([category, categoryRooms]) => {
                        const key = `${server}::${category}`
                        const categoryCollapsed = !!collapsedCategories[key]
                        return (
                          <div key={key} className="mb-1">
                            <button onClick={() => toggleCategory(server, category)} className="w-full flex items-center gap-2 px-3 py-1 text-left hover:bg-zinc-800/30">
                              <ChevronDown className={cn("h-3 w-3 text-zinc-600 transition-transform", categoryCollapsed && "-rotate-90")} />
                              <span className="text-[10px] uppercase tracking-wide text-zinc-500">{category}</span>
                              <Badge className="ml-auto h-4 text-[10px] bg-zinc-800 text-zinc-500">{categoryRooms.length}</Badge>
                            </button>

                            {!categoryCollapsed && categoryRooms.map((room) => {
                              const isActive = room.id === activeRoomId
                              const lastMsg = room.last_message
                              const { channel } = splitDiscordPath(room.name)
                              return (
                                <button
                                  key={room.id}
                                  onClick={() => {
                                    router.push(`/rooms/${room.id}`)
                                    onNavigate?.()
                                  }}
                                  className={cn(
                                    "w-full flex items-center gap-2 px-5 py-2 text-left transition-colors",
                                    isActive ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800/50"
                                  )}
                                >
                                  <Hash className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className={cn("text-sm truncate", isActive ? "text-zinc-100 font-medium" : "text-zinc-300")}>{channel}</span>
                                      {lastMsg && <span className="text-[10px] text-zinc-600 shrink-0">{formatLastMessageTime(lastMsg.created_at)}</span>}
                                    </div>
                                    <p className="text-[11px] text-zinc-500 truncate">
                                      {lastMsg ? `${lastMsg.agent?.name || "Alguém"}: ${lastMsg.content}` : "Sem mensagens"}
                                    </p>
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
