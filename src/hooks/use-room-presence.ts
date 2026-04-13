"use client"

import { useEffect, useState } from "react"
import { chatApi, type RoomPresence } from "@/lib/chat-api"

interface UseRoomPresenceReturn {
  presence: RoomPresence | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useRoomPresence(roomId?: string | null, pollMs = 15000): UseRoomPresenceReturn {
  const [presence, setPresence] = useState<RoomPresence | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!roomId) {
      setPresence(null)
      setLoading(false)
      return
    }
    try {
      setError(null)
      const data = await chatApi.getRoomPresence(roomId)
      setPresence(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar presença da sala")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    if (!roomId) return
    const id = window.setInterval(load, pollMs)
    return () => window.clearInterval(id)
  }, [roomId, pollMs])

  return { presence, loading, error, refresh: load }
}
