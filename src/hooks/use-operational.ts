"use client"

import { useEffect, useState } from "react"
import { chatApi, type OperationalJob, type OperationalRuntime } from "@/lib/chat-api"

interface UseOperationalOptions {
  roomId?: string | null
  pollMs?: number
}

interface UseOperationalReturn {
  jobs: OperationalJob[]
  runtime: OperationalRuntime | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useOperational({ roomId, pollMs = 10000 }: UseOperationalOptions): UseOperationalReturn {
  const [jobs, setJobs] = useState<OperationalJob[]>([])
  const [runtime, setRuntime] = useState<OperationalRuntime | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setError(null)
      const [jobsData, runtimeData] = await Promise.all([
        chatApi.getOperationalJobs(),
        chatApi.getOperationalRuntime(),
      ])
      const filtered = roomId ? jobsData.filter((job) => job.room_id === roomId) : jobsData
      setJobs(filtered)
      setRuntime(runtimeData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar operações")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const id = window.setInterval(load, pollMs)
    return () => window.clearInterval(id)
  }, [roomId, pollMs])

  return { jobs, runtime, loading, error, refresh: load }
}
