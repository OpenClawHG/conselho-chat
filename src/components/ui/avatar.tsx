"use client"

import { cn } from "@/lib/utils"

interface AvatarProps {
  src?: string | null
  fallback: string
  size?: "sm" | "md" | "lg"
  className?: string
  borderColor?: string
}

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
}

export function Avatar({ src, fallback, size = "md", className, borderColor }: AvatarProps) {
  return (
    <div
      className={cn(
        "relative shrink-0 rounded-full overflow-hidden bg-zinc-700 flex items-center justify-center font-medium text-zinc-300",
        sizeClasses[size],
        borderColor && `ring-2 ${borderColor}`,
        className
      )}
    >
      {src ? (
        <img
          src={src}
          alt={fallback}
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{fallback.charAt(0).toUpperCase()}</span>
      )}
    </div>
  )
}
