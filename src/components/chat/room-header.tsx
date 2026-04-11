"use client"

import { Settings, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Room } from "@/lib/chat-api"

interface RoomHeaderProps {
  room: Room
  onSettingsClick?: () => void
}

export function RoomHeader({ room, onSettingsClick }: RoomHeaderProps) {
  const members = room.members || []
  const memberCount = (room as any).member_count || members.length || 0

  return (
    <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100 truncate">
            {room.name}
          </h2>
          {room.description && (
            <p className="text-xs text-zinc-500 truncate max-w-xs">
              {room.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-xs text-zinc-500">
          <Users className="h-3.5 w-3.5" />
          <span>{memberCount} membro{memberCount !== 1 ? "s" : ""}</span>
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onSettingsClick}
          className="text-zinc-500 hover:text-zinc-300"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
