"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { chatApi, type Room } from "@/lib/chat-api"
import { useMessages } from "@/hooks/use-messages"
import { useRoomPresence } from "@/hooks/use-room-presence"
import { RoomHeader } from "@/components/chat/room-header"
import { MessageList } from "@/components/chat/message-list"
import { MessageInput } from "@/components/chat/message-input"
import { TeamPresencePanel } from "@/components/chat/team-presence-panel"
import { Skeleton } from "@/components/ui/skeleton"

export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const roomId = params?.roomId as string
  const [room, setRoom] = useState<Room | null>(null)
  const [roomLoading, setRoomLoading] = useState(true)
  const [roomError, setRoomError] = useState<string | null>(null)
  const [currentAgentId, setCurrentAgentId] = useState<string | undefined>()

  const { messages, loading: msgsLoading, sendMessage, loadMore, hasMore } = useMessages(roomId)
  const { presence, loading: presenceLoading, error: presenceError } = useRoomPresence(
    roomId,
    15000,
  )

  // Load room data
  useEffect(() => {
    if (!roomId) return
    let cancelled = false

    async function redirectToViralMindMain() {
      try {
        const roomsData = await chatApi.getRooms()
        const roomsList = Array.isArray(roomsData) ? roomsData : (roomsData as any).rooms || []
        const viralmindMain = roomsList.find((candidate: Room) => candidate.name === "ViralMind / geral")
        if (!cancelled && viralmindMain && viralmindMain.id !== roomId) {
          router.replace(`/rooms/${viralmindMain.id}`)
          return true
        }
      } catch {
        // fallback silencioso: mantem erro atual
      }
      return false
    }

    async function load() {
      setRoomLoading(true)
      setRoomError(null)
      try {
        const data = await chatApi.getRoom(roomId)
        if (!cancelled) {
          if (data.name?.startsWith("Archive / ViralMind /")) {
            const redirected = await redirectToViralMindMain()
            if (!redirected) {
              setRoom(data)
            }
          } else {
            setRoom(data)
          }
        }
      } catch (err) {
        if (!cancelled) {
          const redirected = await redirectToViralMindMain()
          if (!redirected) {
            setRoomError(err instanceof Error ? err.message : "Erro ao carregar sala")
          }
        }
      } finally {
        if (!cancelled) setRoomLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [roomId, router])

  // Detect current user agent
  useEffect(() => {
    let cancelled = false

    async function loadMe() {
      try {
        const me = await chatApi.getMe()
        if (!cancelled) setCurrentAgentId(me.id)
      } catch {
        // fallback silencioso
      }
    }

    loadMe()
    return () => {
      cancelled = true
    }
  }, [roomId])

  async function handleSend(content: string) {
    try {
      await sendMessage(content)
    } catch {
      // Error handled in hook
    }
  }

  if (roomLoading) {
    return (
      <div className="flex-1 flex flex-col">
        {/* Header skeleton */}
        <div className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-900 px-4 py-3">
          <Skeleton className="h-5 w-32" />
          <div className="flex-1" />
          <Skeleton className="h-7 w-20" />
        </div>
        {/* Messages skeleton */}
        <div className="flex-1 flex flex-col gap-4 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-2">
              <Skeleton className="h-7 w-7 rounded-full shrink-0" />
              <div className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-10 w-48 rounded-2xl" />
              </div>
            </div>
          ))}
        </div>
        {/* Input skeleton */}
        <div className="border-t border-zinc-800 bg-zinc-900 p-3">
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (roomError || !room) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-sm">{roomError || "Sala nao encontrada"}</p>
          <p className="text-zinc-500 text-xs mt-1">Verifique se a sala existe e tente novamente</p>
        </div>
      </div>
    )
  }

  const liveSummary = {
    working: (presence?.members || []).filter((item) => item.state === "working").length,
    blocked: (presence?.members || []).filter((item) => item.state === "blocked").length,
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-h-0 flex-1 flex-col">
        <RoomHeader room={room} liveSummary={liveSummary} />

        <MessageList
          messages={messages}
          currentAgentId={currentAgentId}
          loading={msgsLoading}
          onLoadMore={loadMore}
          hasMore={hasMore}
        />

        <MessageInput
          onSend={handleSend}
          roomId={roomId}
          members={room.members || []}
          placeholder={`Mensagem para ${room.name}...`}
        />
      </div>

      <aside className="hidden xl:flex xl:w-[360px] xl:shrink-0">
        <TeamPresencePanel
          room={room}
          loading={presenceLoading}
          error={presenceError}
          presence={presence}
        />
      </aside>
    </div>
  )
}
