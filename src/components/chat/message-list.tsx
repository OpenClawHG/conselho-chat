"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { format, isToday, isYesterday } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { MessageBubble } from "./message-bubble"
import type { Message } from "@/lib/chat-api"

interface MessageListProps {
  messages: Message[]
  currentAgentId?: string
  loading?: boolean
  onLoadMore?: () => void
  hasMore?: boolean
}

function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr)
  if (isToday(date)) return "Hoje"
  if (isYesterday(date)) return "Ontem"
  return format(date, "d MMM", { locale: ptBR })
}

function getDateKey(dateStr: string): string {
  return new Date(dateStr).toDateString()
}

export function MessageList({
  messages,
  currentAgentId,
  loading,
  onLoadMore,
  hasMore,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages.length, autoScroll])

  // Detect scroll position
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    function handleScroll() {
      if (!container) return
      const { scrollTop, scrollHeight, clientHeight } = container
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
      setShowScrollButton(!isNearBottom)
      setAutoScroll(isNearBottom)
    }

    container.addEventListener("scroll", handleScroll)
    return () => container.removeEventListener("scroll", handleScroll)
  }, [])

  if (loading) {
    return (
      <div className="flex-1 flex flex-col gap-4 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={cn("flex gap-2", i % 3 === 0 ? "flex-row-reverse" : "")}>
            <Skeleton className="h-7 w-7 rounded-full shrink-0" />
            <div className="flex flex-col gap-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className={cn("h-12 rounded-2xl", i % 2 === 0 ? "w-48" : "w-64")} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-500 text-sm">Nenhuma mensagem ainda</p>
          <p className="text-zinc-600 text-xs mt-1">Envie a primeira mensagem para iniciar a conversa</p>
        </div>
      </div>
    )
  }

  // Group messages by date
  let lastDateKey = ""
  let lastAgentId = ""

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={containerRef}
        className="h-full overflow-y-auto"
      >
        {/* Load more */}
        {hasMore && (
          <div className="flex justify-center py-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onLoadMore}
              className="text-xs text-zinc-500"
            >
              Carregar mensagens anteriores
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-0.5 py-2">
          {messages.map((message, idx) => {
            const dateKey = getDateKey(message.created_at)
            const showDate = dateKey !== lastDateKey
            lastDateKey = dateKey

            const showAgent = message.agent_id !== lastAgentId || showDate
            lastAgentId = message.agent_id

            const isOwn = message.agent_id === currentAgentId

            return (
              <div key={message.id}>
                {showDate && (
                  <div className="flex justify-center py-3">
                    <span className="text-[11px] text-zinc-500 bg-zinc-800/80 rounded-full px-3 py-0.5">
                      {formatDateSeparator(message.created_at)}
                    </span>
                  </div>
                )}
                <MessageBubble
                  message={message}
                  isOwn={isOwn}
                  showAgent={showAgent}
                  agent={message.agent}
                />
              </div>
            )
          })}
        </div>

        <div ref={bottomRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
          <Button
            variant="default"
            size="icon-sm"
            onClick={scrollToBottom}
            className="rounded-full bg-zinc-800 hover:bg-zinc-700 shadow-lg border border-zinc-700"
          >
            <ArrowDown className="h-4 w-4 text-zinc-300" />
          </Button>
        </div>
      )}
    </div>
  )
}
