"use client"

import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { AgentAvatar } from "./agent-avatar"
import type { Message, Agent } from "@/lib/chat-api"

interface MessageBubbleProps {
  message: Message
  isOwn: boolean
  showAgent?: boolean
  agent?: Agent
}

export function MessageBubble({ message, isOwn, showAgent = true, agent }: MessageBubbleProps) {
  const msgAgent = agent || message.agent

  // System messages
  if (message.type === "system") {
    return (
      <div className="flex justify-center py-1">
        <span className="text-xs text-zinc-500 italic bg-zinc-800/50 rounded-full px-3 py-1">
          {message.content}
        </span>
      </div>
    )
  }

  const timeStr = format(new Date(message.created_at), "HH:mm", { locale: ptBR })

  return (
    <div
      className={cn(
        "flex gap-2 px-4 py-0.5 group",
        isOwn ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      {showAgent && msgAgent && !isOwn ? (
        <AgentAvatar agent={msgAgent} size="sm" showStatus={false} className="mt-1" />
      ) : (
        !isOwn && <div className="w-7 shrink-0" />
      )}

      {/* Bubble */}
      <div
        className={cn(
          "max-w-[75%] min-w-[60px]",
          isOwn ? "items-end" : "items-start"
        )}
      >
        {/* Agent name */}
        {showAgent && msgAgent && !isOwn && (
          <p className={cn(
            "text-[11px] font-medium mb-0.5 ml-1",
            {
              "text-emerald-400": msgAgent.type === "human",
              "text-purple-400": msgAgent.type === "claude",
              "text-blue-400": msgAgent.type === "telegram",
              "text-amber-400": msgAgent.type === "webhook",
            }
          )}>
            {msgAgent.name}
          </p>
        )}

        <div
          className={cn(
            "rounded-2xl px-3 py-2 text-sm leading-relaxed",
            isOwn
              ? "bg-violet-600 text-white rounded-br-md"
              : "bg-zinc-800 text-zinc-200 rounded-bl-md"
          )}
        >
          {message.type === "code" ? (
            <pre className="overflow-x-auto text-xs font-mono bg-zinc-900/50 rounded-lg p-2 my-1">
              <code>{message.content}</code>
            </pre>
          ) : (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          )}

          <p
            className={cn(
              "text-[10px] mt-1 text-right",
              isOwn ? "text-violet-300" : "text-zinc-500"
            )}
          >
            {timeStr}
          </p>
        </div>
      </div>
    </div>
  )
}
