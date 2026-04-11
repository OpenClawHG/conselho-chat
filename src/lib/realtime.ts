import { createClient } from './supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Message, Agent } from './chat-api'

const channels = new Map<string, RealtimeChannel>()

// Cache of known agents to hydrate realtime messages
const agentCache = new Map<string, { name: string; type: Agent['type'] }>()

export function cacheAgent(id: string, name: string, type: Agent['type']): void {
  agentCache.set(id, { name, type })
}

export function cacheAgentsFromMessages(messages: Message[]): void {
  for (const msg of messages) {
    if (msg.agent?.id && msg.agent?.name) {
      agentCache.set(msg.agent.id, { name: msg.agent.name, type: msg.agent.type })
    }
    if (msg.agent_id && msg.agent?.name) {
      agentCache.set(msg.agent_id, { name: msg.agent.name, type: msg.agent.type })
    }
  }
}

function hydrateRealtimeMessage(raw: Record<string, unknown>): Message {
  const senderId = (raw.sender_id || raw.agent_id || '') as string
  const senderName = (raw.sender_name || '') as string
  const senderType = (raw.sender_type || '') as string

  // Try cache if sender_name is missing
  const cached = agentCache.get(senderId)
  const finalName = senderName || cached?.name || 'Desconhecido'
  const finalType = senderType || cached?.type || 'webhook'

  return {
    id: raw.id as string,
    room_id: raw.room_id as string,
    agent_id: senderId,
    content: (raw.content || '') as string,
    type: (raw.content_type || raw.type || 'text') as Message['type'],
    created_at: raw.created_at as string,
    agent: {
      id: senderId,
      name: finalName,
      type: finalType as Agent['type'],
      status: 'online',
      created_at: raw.created_at as string,
    },
  }
}

export function subscribeToRoom(
  roomId: string,
  onMessage: (message: Message) => void
): RealtimeChannel {
  // Unsubscribe from existing channel if any
  unsubscribeFromRoom(roomId)

  const supabase = createClient()

  const channel = supabase
    .channel(`room:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        const msg = hydrateRealtimeMessage(payload.new as Record<string, unknown>)
        onMessage(msg)
      }
    )
    .subscribe()

  channels.set(roomId, channel)
  return channel
}

export function unsubscribeFromRoom(roomId: string): void {
  const existing = channels.get(roomId)
  if (existing) {
    const supabase = createClient()
    supabase.removeChannel(existing)
    channels.delete(roomId)
  }
}

export function unsubscribeAll(): void {
  const supabase = createClient()
  channels.forEach((channel) => {
    supabase.removeChannel(channel)
  })
  channels.clear()
}
