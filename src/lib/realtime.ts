import { createClient } from './supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Message } from './chat-api'

const channels = new Map<string, RealtimeChannel>()

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
        const msg = payload.new as Message
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
