"use client"

import { useState, useRef, useEffect, useCallback, type KeyboardEvent, type DragEvent, type ClipboardEvent } from "react"
import { Send, Paperclip, X, FileIcon, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { Agent } from "@/lib/chat-api"
import { uploadFile, formatAttachmentMessage, isImageType, formatFileSize } from "@/lib/file-upload"

interface MessageInputProps {
  onSend: (content: string) => void
  disabled?: boolean
  members?: Array<{ agent: Agent }>
  placeholder?: string
  roomId?: string
}

interface PendingFile {
  file: File
  preview?: string
}

export function MessageInput({
  onSend,
  disabled = false,
  members = [],
  placeholder = "Escreva uma mensagem...",
  roomId,
}: MessageInputProps) {
  const [value, setValue] = useState("")
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState("")
  const [selectedMention, setSelectedMention] = useState(0)
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px"
  }, [value])

  useEffect(() => {
    return () => {
      if (pendingFile?.preview) URL.revokeObjectURL(pendingFile.preview)
    }
  }, [pendingFile])

  const filteredMembers = members.filter((m) =>
    m.agent.name.toLowerCase().includes(mentionQuery.toLowerCase())
  )

  const handleMentionSelect = useCallback(
    (agentName: string) => {
      const atIndex = value.lastIndexOf("@")
      if (atIndex >= 0) {
        const before = value.substring(0, atIndex)
        setValue(before + "@" + agentName + " ")
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileSelect = (file: File) => {
    const preview = isImageType(file.type) ? URL.createObjectURL(file) : undefined
    setPendingFile({ file, preview })
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
    e.target.value = ""
  }

  const clearPendingFile = () => {
    if (pendingFile?.preview) URL.revokeObjectURL(pendingFile.preview)
    setPendingFile(null)
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileSelect(file)
  }

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        e.preventDefault()
        const file = items[i].getAsFile()
        if (file) handleFileSelect(file)
        return
      }
    }
  }

    const handleSend = async () => {
    if (uploading || disabled) return
    if (pendingFile && roomId) {
      setUploading(true)
      setUploadProgress(0)
      try {
        const attachment = await uploadFile(roomId, pendingFile.file, setUploadProgress)
        onSend(formatAttachmentMessage(attachment))
        clearPendingFile()
      } catch (err) {
        console.error("Upload failed:", err)
      } finally {
        setUploading(false)
        setUploadProgress(0)
      }
      const trimmed = value.trim()
      if (trimmed) {
        onSend(trimmed)
        setValue("")
      }
      return
    }
    const trimmed = value.trim()
    if (!trimmed) return
    onSend(trimmed)
    setValue("")
    setShowMentions(false)
    if (textareaRef.current) textareaRef.current.style.height = "auto"
  }

  const canSend = !disabled && !uploading && (value.trim() || pendingFile)

  return (
    <div
      className={cn(
        "relative border-t border-zinc-800 bg-zinc-900 p-3 transition-colors",
        dragOver && "bg-violet-900/20 border-violet-500"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-violet-900/30 border-2 border-dashed border-violet-500 rounded-lg z-30 pointer-events-none">
          <p className="text-violet-300 font-medium text-sm">Solte o arquivo aqui</p>
        </div>
      )}

      {pendingFile && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2">
          {pendingFile.preview ? (
            <img src={pendingFile.preview} alt={pendingFile.file.name} className="h-12 w-12 rounded object-cover" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded bg-zinc-700">
              <FileIcon className="h-5 w-5 text-zinc-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-zinc-200 truncate">{pendingFile.file.name}</p>
            <p className="text-xs text-zinc-500">{formatFileSize(pendingFile.file.size)}</p>
          </div>
          {uploading ? (
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 transition-all duration-300 rounded-full" style={{ width: uploadProgress + "%" }} />
              </div>
              <Loader2 className="h-4 w-4 text-violet-400 animate-spin" />
            </div>
          ) : (
            <button onClick={clearPendingFile} className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {showMentions && filteredMembers.length > 0 && (
        <div className="absolute bottom-full left-3 right-3 mb-1 rounded-lg border border-zinc-700 bg-zinc-800 py-1 shadow-xl max-h-40 overflow-y-auto z-20">
          {filteredMembers.map((member, idx) => (
            <button
              key={member.agent.id}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left transition-colors",
                idx === selectedMention ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:bg-zinc-700/50"
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

      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileInputChange} accept="image/*,.pdf,.doc,.docx,.txt,.md,.json,.csv,.zip" />

      <div className="flex items-end gap-2">
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          size="icon"
          variant="ghost"
          className="shrink-0 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          title="Enviar arquivo"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={disabled ? "Selecione uma sala para enviar mensagens" : placeholder}
          disabled={disabled || uploading}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <Button
          onClick={handleSend}
          disabled={!canSend}
          size="icon"
          className={cn(
            "shrink-0 rounded-xl transition-colors",
            canSend ? "bg-violet-600 hover:bg-violet-700 text-white" : "bg-zinc-800 text-zinc-500"
          )}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
