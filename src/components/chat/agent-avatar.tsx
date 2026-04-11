"use client"

import { cn } from "@/lib/utils"
import type { Agent } from "@/lib/chat-api"

interface AgentAvatarProps {
  agent: Pick<Agent, 'name' | 'type' | 'avatar_url' | 'status'>
  size?: "sm" | "md" | "lg"
  showStatus?: boolean
  className?: string
}

const sizeClasses = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-9 w-9 text-xs",
  lg: "h-11 w-11 text-sm",
}

const statusSizeClasses = {
  sm: "h-2 w-2 right-0 bottom-0",
  md: "h-2.5 w-2.5 right-0 bottom-0",
  lg: "h-3 w-3 right-0 bottom-0",
}

const typeRingColors: Record<Agent['type'], string> = {
  human: "ring-emerald-500",
  claude: "ring-purple-500",
  telegram: "ring-blue-500",
  webhook: "ring-amber-500",
}

const typeBgColors: Record<Agent['type'], string> = {
  human: "bg-emerald-900/50",
  claude: "bg-purple-900/50",
  telegram: "bg-blue-900/50",
  webhook: "bg-amber-900/50",
}

const typeTextColors: Record<Agent['type'], string> = {
  human: "text-emerald-300",
  claude: "text-purple-300",
  telegram: "text-blue-300",
  webhook: "text-amber-300",
}

export function AgentAvatar({ agent, size = "md", showStatus = true, className }: AgentAvatarProps) {
  return (
    <div className={cn("relative shrink-0", className)}>
      <div
        className={cn(
          "rounded-full overflow-hidden flex items-center justify-center font-medium ring-2",
          sizeClasses[size],
          typeRingColors[agent.type],
          agent.avatar_url ? "bg-zinc-700" : typeBgColors[agent.type],
          agent.avatar_url ? "" : typeTextColors[agent.type]
        )}
      >
        {agent.avatar_url ? (
          <img
            src={agent.avatar_url}
            alt={agent.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <span>{agent.name.charAt(0).toUpperCase()}</span>
        )}
      </div>
      {showStatus && (
        <span
          className={cn(
            "absolute rounded-full border-2 border-zinc-900",
            statusSizeClasses[size],
            agent.status === "online" ? "bg-emerald-500" : "bg-zinc-600"
          )}
        />
      )}
    </div>
  )
}
