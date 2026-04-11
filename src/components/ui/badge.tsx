"use client"

import { cn } from "@/lib/utils"

interface BadgeProps {
  children: React.ReactNode
  variant?: "default" | "secondary" | "destructive" | "outline"
  className?: string
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        {
          "bg-violet-600 text-white": variant === "default",
          "bg-zinc-700 text-zinc-300": variant === "secondary",
          "bg-red-600 text-white": variant === "destructive",
          "border border-zinc-600 text-zinc-400": variant === "outline",
        },
        className
      )}
    >
      {children}
    </span>
  )
}
