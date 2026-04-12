"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { chatApi, type Room } from "@/lib/chat-api"
import { useMessages } from "@/hooks/use-messages"
import { useOperational } from "@/hooks/use-operational"
import { RoomHeader } from "@/components/chat/room-header"
import { MessageList } from "@/components/chat/message-list"
import { MessageInput } from "@/components/chat/message-input"
import { OpsPanel } from "@/components/chat/ops-panel"
import { Skeleton } from "@/components/ui/skeleton"

export default function RoomPage() {
  const params = useParams()
  const roomId = params?.roomId as string
  const [room, setRoom] = useState<Room | null>(null)
  const [roomLoading, setRoomLoading] = useState(true)
  const [roomError, setRoomError] = useState<string | null>(null)
  const [currentAgentId, setCurrentAgentId] = useState<string | undefined>()
  const [opsOpen, setOpsOpen] = useState(false)

  const { messages, loading: msgsLoading, sendMessage, loadMore, hasMore } = useMessages(roomId)
  const { jobs, runtime, loading: opsLoading, error: opsError, refresh: refreshOps } = useOperational({ roomId })

  useEffect(() => {
    if (typeof window === "undefined") return
    const media = window.matchMedia("(min-width: 1024px)")
    const apply = () => setOpsOpen(media.matches)
    apply()
    media.addEventListener("change", apply)
    return () => media.removeEventListener("change", apply)
  }, [])

  // Load room data
  useEffect(() => {
    if (!roomId) return
    let cancelled = false

    async function load() {
      setRoomLoading(true)
      setRoomError(null)
      try {
        const data = await chatApi.getRoom(roomId)
        if (!cancelled) setRoom(data)
      } catch (err) {
        if (!cancelled) {
          setRoomError(err instanceof Error ? err.message : "Erro ao carregar sala")
        }
      } finally {
        if (!cancelled) setRoomLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [roomId])

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

  async function handleSend(content: string, metadata?: Record<string, unknown>) {
    try {
      await sendMessage(content, 'text', metadata)
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

  return (
    <div className="flex-1 flex min-h-0">
      <div className={cn("flex min-h-0 flex-1 flex-col", !opsOpen && "w-full")}>
        <RoomHeader
          room={room}
          onOpsToggle={() => setOpsOpen((prev) => !prev)}
          opsOpen={opsOpen}
          openJobs={jobs.filter((job) => job.status !== "done").length}
        />

        <div className={cn("min-h-0 flex-1 flex-col", opsOpen ? "hidden lg:flex" : "flex")}>
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
      </div>

      <div className={cn("min-h-0 border-l border-zinc-800", opsOpen ? "flex w-full lg:w-[390px]" : "hidden")}>
        <OpsPanel
          jobs={jobs}
          runtime={runtime}
          loading={opsLoading}
          error={opsError}
          onRefresh={refreshOps}
          roomName={room.name}
        />
      </div>
    </div>
  )
}
