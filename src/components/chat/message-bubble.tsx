"use client"

import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Download, FileIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { AgentAvatar } from "./agent-avatar"
import type { Message, Agent } from "@/lib/chat-api"
import { isAttachmentMessage, parseAttachment, isImageType, formatFileSize } from "@/lib/file-upload"
import ReactMarkdown from "react-markdown"

interface MessageBubbleProps {
  message: Message
  isOwn: boolean
  showAgent?: boolean
  agent?: Agent
}

function AttachmentContent({ content, isOwn }: { content: string; isOwn: boolean }) {
  const attachment = parseAttachment(content)
  if (!attachment) return <p className="whitespace-pre-wrap break-words">{content}</p>

  if (isImageType(attachment.type)) {
    return (
      <div className="space-y-1">
        <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="block">
          <img
            src={attachment.url}
            alt={attachment.name}
            className="max-w-full max-h-[300px] rounded-lg object-contain cursor-pointer hover:opacity-90 transition-opacity"
            loading="lazy"
          />
        </a>
        <div className="flex items-center gap-1.5 text-[11px] opacity-70">
          <FileIcon className="h-3 w-3" />
          <span className="truncate">{attachment.name}</span>
          <span>({formatFileSize(attachment.size)})</span>
        </div>
      </div>
    )
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-center gap-3 rounded-lg p-2.5 transition-colors",
        isOwn ? "bg-violet-700/50 hover:bg-violet-700/70" : "bg-zinc-700/50 hover:bg-zinc-700/70"
      )}
    >
      <div className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
        isOwn ? "bg-violet-800" : "bg-zinc-600"
      )}>
        <FileIcon className="h-5 w-5 text-zinc-300" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{attachment.name}</p>
        <p className={cn(
          "text-[11px]",
          isOwn ? "text-violet-300" : "text-zinc-400"
        )}>
          {formatFileSize(attachment.size)}
        </p>
      </div>
      <Download className={cn(
        "h-4 w-4 shrink-0",
        isOwn ? "text-violet-300" : "text-zinc-400"
      )} />
    </a>
  )
}

export function MessageBubble({ message, isOwn, showAgent = true, agent }: MessageBubbleProps) {
  const msgAgent = agent || message.agent
  const hasAttachment = isAttachmentMessage(message.content)

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
      {showAgent && msgAgent && !isOwn ? (
        <AgentAvatar agent={msgAgent} size="sm" showStatus={false} className="mt-1" />
      ) : (
        !isOwn && <div className="w-7 shrink-0" />
      )}

      <div
        className={cn(
          "min-w-[60px]",
          hasAttachment ? "max-w-[85%]" : "max-w-[75%]",
          isOwn ? "items-end" : "items-start"
        )}
      >
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
          {hasAttachment ? (
            <AttachmentContent content={message.content} isOwn={isOwn} />
          ) : message.type === "code" ? (
            <pre className="overflow-x-auto text-xs font-mono bg-zinc-900/50 rounded-lg p-2 my-1">
              <code>{message.content}</code>
            </pre>
          ) : (
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="whitespace-pre-wrap break-words mb-1 last:mb-0">{children}</p>,
                strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                code: ({ children }) => <code className="bg-zinc-900/50 rounded px-1 py-0.5 text-xs font-mono">{children}</code>,
                ul: ({ children }) => <ul className="list-disc list-inside ml-1 mb-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside ml-1 mb-1">{children}</ol>,
                li: ({ children }) => <li className="mb-0.5">{children}</li>,
                a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="underline text-violet-300 hover:text-violet-200">{children}</a>,
              }}
            >{message.content}</ReactMarkdown>
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
