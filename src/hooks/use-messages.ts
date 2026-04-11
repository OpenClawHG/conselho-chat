"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { chatApi, type Message } from "@/lib/chat-api"
import { subscribeToRoom, unsubscribeFromRoom } from "@/lib/realtime"

const PAGE_SIZE = 50

interface UseMessagesReturn {
  messages: Message[]
  loading: boolean
  error: string | null
  sendMessage: (content: string, type?: 'text' | 'code') => Promise<void>
  loadMore: () => Promise<void>
  hasMore: boolean
}

export function useMessages(roomId: string | null): UseMessagesReturn {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const loadingRef = useRef(false)

  // Load initial messages
  useEffect(() => {
    if (!roomId) {
      setMessages([])
      return
    }

    let cancelled = false

    async function loadMessages() {
      setLoading(true)
      setError(null)
      loadingRef.current = true

      try {
        const data = await chatApi.getMessages(roomId!, { limit: PAGE_SIZE })
        // API pode retornar {messages: [...]} ou array direto
        const msgList = Array.isArray(data) ? data : (data as any).messages || (data as any).items || []
        if (!cancelled) {
          setMessages(msgList)
          setHasMore(msgList.length >= PAGE_SIZE)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro ao carregar mensagens")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          loadingRef.current = false
        }
      }
    }

    loadMessages()

    return () => {
      cancelled = true
    }
  }, [roomId])

  // Subscribe to Realtime
  useEffect(() => {
    if (!roomId) return

    const channel = subscribeToRoom(roomId, (newMessage) => {
      setMessages((prev) => {
        // Avoid duplicates
        if (prev.some((m) => m.id === newMessage.id)) return prev
        return [...prev, newMessage]
      })
    })

    return () => {
      unsubscribeFromRoom(roomId)
    }
  }, [roomId])

  // Load older messages
  const loadMore = useCallback(async () => {
    if (!roomId || loadingRef.current || messages.length === 0) return
    loadingRef.current = true

    try {
      const oldestMessage = messages[0]
      const data = await chatApi.getMessages(roomId, {
        before: oldestMessage.id,
        limit: PAGE_SIZE,
      })
      const msgList = Array.isArray(data) ? data : (data as any).messages || (data as any).items || []
      setMessages((prev) => [...msgList, ...prev])
      setHasMore(msgList.length >= PAGE_SIZE)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar mensagens anteriores")
    } finally {
      loadingRef.current = false
    }
  }, [roomId, messages])

  // Send message
  const sendMessage = useCallback(
    async (content: string, type: 'text' | 'code' = 'text') => {
      if (!roomId) return

      try {
        const message = await chatApi.sendMessage(roomId, { content, type })
        // Realtime will handle adding it, but add optimistically if not already there
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev
          return [...prev, message]
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao enviar mensagem")
        throw err
      }
    },
    [roomId]
  )

  return { messages, loading, error, sendMessage, loadMore, hasMore }
}
