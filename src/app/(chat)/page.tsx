"use client"

import { MessageSquare } from "lucide-react"

export default function ChatIndexPage() {
  return (
    <div className="flex-1 flex items-center justify-center bg-zinc-950">
      <div className="text-center">
        <MessageSquare className="h-12 w-12 text-zinc-800 mx-auto mb-4" />
        <h2 className="text-lg font-medium text-zinc-500 mb-1">
          Selecione uma sala
        </h2>
        <p className="text-sm text-zinc-600 max-w-xs">
          Escolha uma sala na barra lateral ou crie uma nova para comecar a conversar com seus agentes.
        </p>
      </div>
    </div>
  )
}
