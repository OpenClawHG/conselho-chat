import { createClient } from './supabase'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://viralmind.openclawhg.tech'

function normalizeAgentType(type?: string): Agent['type'] {
  if (!type) return 'webhook'
  if (type === 'telegram_bot') return 'telegram'
  if (type === 'human' || type === 'claude' || type === 'telegram' || type === 'webhook') return type
  return 'webhook'
}

function normalizeAgent(raw: any): Agent {
  return {
    id: raw?.id || raw?.agent_id || '',
    name: raw?.name || raw?.agent_name || raw?.sender_name || 'Desconhecido',
    type: normalizeAgentType(raw?.type || raw?.agent_type || raw?.sender_type),
    avatar_url: raw?.avatar_url,
    status: raw?.status || (raw?.is_active === false ? 'offline' : 'online'),
    created_at: raw?.created_at || new Date().toISOString(),
    token: raw?.token || raw?.plaintext_token,
  }
}

function normalizeMessage(raw: any): Message {
  const agent = raw?.agent ? normalizeAgent(raw.agent) : normalizeAgent({
    id: raw?.sender_id || raw?.agent_id,
    name: raw?.sender_name,
    type: raw?.sender_type,
  })

  return {
    id: raw?.id,
    room_id: raw?.room_id,
    agent_id: raw?.agent_id || raw?.sender_id,
    content: raw?.content || '',
    type: raw?.type || raw?.content_type || 'text',
    created_at: raw?.created_at,
    agent,
    metadata: raw?.metadata || undefined,
  }
}

function normalizeRoom(raw: any): Room {
  const membersRaw = Array.isArray(raw?.members) ? raw.members : []
  const members = membersRaw.map((m: any) => ({
    agent_id: m?.agent_id,
    role: m?.role || 'member',
    agent: normalizeAgent(m?.agent || m),
  }))

  const lastMessageRaw = raw?.last_message || raw?.lastMessage

  return {
    id: raw?.id,
    name: raw?.name || 'Sem nome',
    description: raw?.description,
    created_at: raw?.created_at || new Date().toISOString(),
    updated_at: raw?.updated_at || raw?.created_at || new Date().toISOString(),
    members,
    last_message: lastMessageRaw ? normalizeMessage(lastMessageRaw) : undefined,
    unread_count: raw?.unread_count || 0,
  }
}

async function fetchAPI<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const headers: Record<string, string> = {}

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }

  if (
    options?.body &&
    typeof options.body === 'string'
  ) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options?.headers as Record<string, string> || {}),
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }))
    throw new Error(error.detail || error.message || `Erro na API: ${response.status}`)
  }

  return response.json()
}

// ---- Types ----

export interface Agent {
  id: string
  name: string
  type: 'human' | 'claude' | 'telegram' | 'webhook'
  avatar_url?: string
  status: 'online' | 'offline'
  created_at: string
  token?: string
}

export interface Room {
  id: string
  name: string
  description?: string
  created_at: string
  updated_at: string
  members: RoomMember[]
  last_message?: Message
  unread_count?: number
}

export interface RoomMember {
  agent_id: string
  role: 'admin' | 'member'
  agent: Agent
}

export interface Message {
  id: string
  room_id: string
  agent_id: string
  content: string
  type: 'text' | 'system' | 'code'
  created_at: string
  agent?: Agent
  metadata?: Record<string, unknown>
}

export interface PendingNotification {
  id: string
  agent_id: string
  room_id: string
  message_id: string
  created_at: string
}

export interface ChatTreeChannel {
  id: string
  name: string
  room_id: string
  description?: string
}

export interface ChatTreeCategory {
  name: string
  channels: ChatTreeChannel[]
}

export interface ChatTreeServer {
  name: string
  categories: ChatTreeCategory[]
}

export interface ChatTree {
  servers: ChatTreeServer[]
}

export interface OperationalJob {
  id: string
  room_id: string
  room_name: string
  message_id: string
  sender_name: string
  request: string
  title: string
  project: string
  kind: string
  owner: string
  tool_hint: string
  status: 'pending' | 'running' | 'done' | 'blocked' | 'escalated'
  created_at: string
  updated_at: string
  latest?: {
    raw_reply?: string
    action?: string
    evidence?: string
    block?: string
    next_step?: string
    metadata?: Record<string, unknown>
  }
}

export interface OperationalOverview {
  total_jobs: number
  counts: Record<string, number>
  stale_jobs: number
  stale_job_ids: string[]
}

export interface RuntimeAgentStatus {
  id: string
  name: string
  type: string
  last_seen_at?: string
  pending_notifications: number
  stale_minutes?: number
  is_stale: boolean
}

export interface RuntimeCronJob {
  id?: string
  name: string
  model?: string | null
  last_error?: string | null
  consecutive_errors: number
  last_run_at_ms?: number | null
}

export interface RuntimeCronOverview {
  total_jobs: number
  error_jobs: number
  all_names: string[]
  error_names: string[]
  jobs: RuntimeCronJob[]
}

export interface OperationalRuntime {
  generated_at: string
  gateway_ok: boolean
  gateway_error?: string | null
  total_pending_notifications: number
  queue_alert: boolean
  agents: RuntimeAgentStatus[]
  stale_agents: string[]
  jobs_overview: OperationalOverview
  cron_overview: RuntimeCronOverview
  cron_alert: boolean
  degraded: boolean
}

// ---- API Methods ----

export const chatApi = {
  // Rooms
  getRooms: async (): Promise<Room[]> => {
    const data = await fetchAPI<unknown>('/api/chat/rooms')
    const list = Array.isArray(data) ? data : (data as { rooms?: unknown[] })?.rooms || []
    return (list || []).map((r) => normalizeRoom(r))
  },

  getRoom: async (id: string): Promise<Room> => {
    const data = await fetchAPI<unknown>(`/api/chat/rooms/${id}`)
    return normalizeRoom(data)
  },

  createRoom: async (data: { name: string; description?: string; member_ids?: string[] }): Promise<Room> => {
    const raw = await fetchAPI<unknown>('/api/chat/rooms', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return normalizeRoom(raw)
  },

  addMember: (roomId: string, data: { agent_id: string; role?: 'admin' | 'member' }) =>
    fetchAPI<RoomMember>(`/api/chat/rooms/${roomId}/members`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Messages
  getMessages: async (roomId: string, params?: { before?: string; limit?: number }): Promise<Message[]> => {
    const query = new URLSearchParams()
    if (params?.before) query.set('before', params.before)
    if (params?.limit) query.set('limit', String(params.limit))
    const qs = query.toString()
    const data = await fetchAPI<unknown>(`/api/chat/rooms/${roomId}/messages${qs ? `?${qs}` : ''}`)
    const list = Array.isArray(data) ? data : (data as { messages?: unknown[] })?.messages || []
    return (list || []).map((m) => normalizeMessage(m))
  },

  sendMessage: async (roomId: string, data: { content: string; type?: 'text' | 'code'; metadata?: Record<string, unknown> }): Promise<Message> => {
    const raw = await fetchAPI<unknown>(`/api/chat/rooms/${roomId}/messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return normalizeMessage(raw)
  },

  // Agents
  getMe: async (): Promise<Agent> => {
    const raw = await fetchAPI<unknown>('/api/chat/agents/me')
    return normalizeAgent(raw)
  },

  getAgents: async (): Promise<Agent[]> => {
    const data = await fetchAPI<unknown[]>('/api/chat/agents')
    return (data || []).map((a) => normalizeAgent(a))
  },

  createAgent: async (data: { name: string; type: Agent['type']; avatar_url?: string }): Promise<Agent & { token: string }> => {
    const raw = await fetchAPI<any>('/api/chat/agents', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    const agent = normalizeAgent(raw)
    return { ...agent, token: raw?.plaintext_token as string }
  },

  updateAgent: async (id: string, data: Partial<Pick<Agent, 'name' | 'avatar_url' | 'status'>>): Promise<Agent> => {
    const raw = await fetchAPI<unknown>(`/api/chat/agents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
    return normalizeAgent(raw)
  },

  // Discord-like tree
  getTree: () =>
    fetchAPI<ChatTree>('/api/chat/tree'),

  // Notifications
  getPending: (agentId: string) =>
    fetchAPI<PendingNotification[]>(`/api/chat/agents/${agentId}/pending`),

  ackNotifications: (data: { notification_ids: string[] }) =>
    fetchAPI<{ acknowledged: number }>('/api/chat/notifications/ack', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getOperationalJobs: async (): Promise<OperationalJob[]> => {
    const data = await fetchAPI<{ jobs?: OperationalJob[] }>('/api/chat/ops/jobs')
    return data?.jobs || []
  },

  getOperationalOverview: () =>
    fetchAPI<OperationalOverview>('/api/chat/ops/overview'),

  getOperationalRuntime: () =>
    fetchAPI<OperationalRuntime>('/api/chat/ops/runtime'),
}
