"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RoomSidebar } from "@/components/chat/room-sidebar"
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase"
import { useRooms } from "@/hooks/use-rooms"

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [newRoomName, setNewRoomName] = useState("")
  const [newRoomDesc, setNewRoomDesc] = useState("")
  const [serverName, setServerName] = useState("")
  const [categoryName, setCategoryName] = useState("")
  const [channelName, setChannelName] = useState("")
  const [creating, setCreating] = useState(false)

  const { rooms, tree, loading: roomsLoading, createRoom } = useRooms()

  // Auth check
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/login")
      } else {
        setAuthChecked(true)
      }
    })
  }, [router])

  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault()
    const finalRoomName =
      serverName.trim() && categoryName.trim() && channelName.trim()
        ? `${serverName.trim()} / ${categoryName.trim()} / ${channelName.trim()}`
        : newRoomName.trim()

    if (!finalRoomName) return
    setCreating(true)
    try {
      const room = await createRoom({
        name: finalRoomName,
        description: newRoomDesc.trim() || undefined,
      })
      setCreateOpen(false)
      setNewRoomName("")
      setNewRoomDesc("")
      setServerName("")
      setCategoryName("")
      setChannelName("")
      router.push(`/rooms/${room.id}`)
    } catch {
      // Error is set in the hook
    } finally {
      setCreating(false)
    }
  }

  if (!authChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="text-zinc-500 text-sm">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-[280px] md:flex-col md:shrink-0 border-r border-zinc-800">
        <RoomSidebar
          rooms={rooms}
          tree={tree || undefined}
          loading={roomsLoading}
          onCreateRoom={() => setCreateOpen(true)}
        />
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-3 border-b border-zinc-800 bg-zinc-900 px-3 py-2.5">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setMobileOpen(true)}
          className="text-zinc-400"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <span className="font-semibold text-zinc-100 text-sm">OpenClaw Chat</span>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-[280px] h-full">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setMobileOpen(false)}
              className="absolute right-2 top-3 z-10 text-zinc-400"
            >
              <X className="h-4 w-4" />
            </Button>
            <RoomSidebar
              rooms={rooms}
              tree={tree || undefined}
              loading={roomsLoading}
              onCreateRoom={() => {
                setMobileOpen(false)
                setCreateOpen(true)
              }}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 pt-11 md:pt-0">
        {children}
      </main>

      {/* Create room dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogHeader>
          <DialogTitle>Nova Sala</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreateRoom} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-zinc-300">Servidor</label>
              <Input
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="Ex: ViralMind"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-zinc-300">Categoria</label>
              <Input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Ex: Produto"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-zinc-300">Canal</label>
              <Input
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="Ex: bugs"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-zinc-300">Ou nome livre da sala (legado)</label>
            <Input
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="Ex: Pipeline de Vídeos"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-zinc-300">
              Descricao <span className="text-zinc-600">(opcional)</span>
            </label>
            <Input
              value={newRoomDesc}
              onChange={(e) => setNewRoomDesc(e.target.value)}
              placeholder="Descricao da sala..."
            />
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCreateOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={creating || (!newRoomName.trim() && !(serverName.trim() && categoryName.trim() && channelName.trim()))}>
              {creating ? "Criando..." : "Criar Sala"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
