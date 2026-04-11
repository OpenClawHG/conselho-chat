"use client"

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react"
import { Send } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { Agent } from "@/lib/chat-api"

interface MessageInputProps {
  onSend: (content: string) => void
  disabled?: boolean
  members?: Array<{ agent: Agent }>
  placeholder?: string
}

export function MessageInput({
  onSend,
  disabled = false,
  members = [],
  placeholder = "Escreva uma mensagem...",
}: MessageInputProps) {
  const [value, setValue] = useState("")
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState("")
  const [selectedMention, setSelectedMention] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px"
  }, [value])

  const filteredMembers = members.filter((m) =>
    m.agent.name.toLowerCase().includes(mentionQuery.toLowerCase())
  )

  const handleMentionSelect = useCallback(
    (agentName: string) => {
      const atIndex = value.lastIndexOf("@")
      if (atIndex >= 0) {
        const before = value.substring(0, atIndex)
        setValue(before + `@${agentName} `)
      }
      setShowMentions(false)
      setMentionQuery("")
      textareaRef.current?.focus()
    },
    [value]
  )

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    setValue(newValue)

    // Check for @ mentions
    const cursorPos = e.target.selectionStart || 0
    const textBefore = newValue.substring(0, cursorPos)
    const atIndex = textBefore.lastIndexOf("@")

    if (atIndex >= 0 && (atIndex === 0 || textBefore[atIndex - 1] === " ")) {
      const query = textBefore.substring(atIndex + 1)
      if (!query.includes(" ")) {
        setMentionQuery(query)
        setShowMentions(true)
        setSelectedMention(0)
        return
      }
    }
    setShowMentions(false)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Mention navigation
    if (showMentions && filteredMembers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedMention((prev) => Math.min(prev + 1, filteredMembers.length - 1))
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedMention((prev) => Math.max(prev - 1, 0))
        return
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault()
        handleMentionSelect(filteredMembers[selectedMention].agent.name)
        return
      }
      if (e.key === "Escape") {
        setShowMentions(false)
        return
      }
    }

    // Send on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue("")
    setShowMentions(false)

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }

  return (
    <div className="relative border-t border-zinc-800 bg-zinc-900 p-3">
      {/* Mention autocomplete */}
      {showMentions && filteredMembers.length > 0 && (
        <div className="absolute bottom-full left-3 right-3 mb-1 rounded-lg border border-zinc-700 bg-zinc-800 py-1 shadow-xl max-h-40 overflow-y-auto z-20">
          {filteredMembers.map((member, idx) => (
            <button
              key={member.agent.id}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left transition-colors",
                idx === selectedMention
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-700/50"
              )}
              onClick={() => handleMentionSelect(member.agent.name)}
              onMouseEnter={() => setSelectedMention(idx)}
            >
              <span
                className={cn("h-2 w-2 rounded-full", {
                  "bg-emerald-500": member.agent.type === "human",
                  "bg-purple-500": member.agent.type === "claude",
                  "bg-blue-500": member.agent.type === "telegram",
                  "bg-amber-500": member.agent.type === "webhook",
                })}
              />
              <span className="font-medium">{member.agent.name}</span>
              <span className="text-xs text-zinc-500">{member.agent.type}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "Selecione uma sala para enviar mensagens" : placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <Button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          size="icon"
          className={cn(
            "shrink-0 rounded-xl transition-colors",
            value.trim()
              ? "bg-violet-600 hover:bg-violet-700 text-white"
              : "bg-zinc-800 text-zinc-500"
          )}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
