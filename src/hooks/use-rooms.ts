"use client"

import { useState, useEffect, useCallback } from "react"
import { chatApi, type Room, type ChatTree } from "@/lib/chat-api"

interface UseRoomsReturn {
  rooms: Room[]
  tree: ChatTree | null
  loading: boolean
  error: string | null
  createRoom: (data: { name: string; description?: string; member_ids?: string[] }) => Promise<Room>
  refresh: () => Promise<void>
}

export function useRooms(): UseRoomsReturn {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tree, setTree] = useState<ChatTree | null>(null)

  const loadRooms = useCallback(async () => {
    try {
      setError(null)
      const [roomsData, treeData] = await Promise.all([
        chatApi.getRooms(),
        chatApi.getTree().catch(() => null),
      ])
      const roomsList = Array.isArray(roomsData) ? roomsData : (roomsData as any).rooms || []
      setRooms(roomsList)
      if (treeData) setTree(treeData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar salas")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRooms()
  }, [loadRooms])

  const createRoom = useCallback(
    async (data: { name: string; description?: string; member_ids?: string[] }) => {
      try {
        const room = await chatApi.createRoom(data)
        setRooms((prev) => [room, ...prev])
        return room
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao criar sala"
        setError(message)
        throw new Error(message)
      }
    },
    []
  )

  return { rooms, tree, loading, error, createRoom, refresh: loadRooms }
}
