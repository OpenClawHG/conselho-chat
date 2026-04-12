import { createClient } from './supabase'

const BUCKET = 'chat-files'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  'image/': ['jpeg', 'png', 'gif', 'webp', 'svg+xml'],
  'application/': ['pdf', 'json', 'zip', 'msword', 'vnd.openxmlformats-officedocument.wordprocessingml.document'],
  'text/': ['plain', 'markdown', 'csv'],
}

function isAllowedType(mimeType: string): boolean {
  if (!mimeType) return false
  for (const [prefix, subtypes] of Object.entries(ALLOWED_MIME_TYPES)) {
    if (mimeType.startsWith(prefix)) {
      const subtype = mimeType.slice(prefix.length)
      return subtypes.includes(subtype)
    }
  }
  return false
}

export interface FileAttachment {
  name: string
  size: number
  type: string
  url: string
}

export const ATTACHMENT_PREFIX = '__ATTACHMENT__'

export function isAttachmentMessage(content: string): boolean {
  return content.startsWith(ATTACHMENT_PREFIX)
}

export function parseAttachment(content: string): FileAttachment | null {
  if (!isAttachmentMessage(content)) return null
  try {
    return JSON.parse(content.slice(ATTACHMENT_PREFIX.length))
  } catch {
    return null
  }
}

export function formatAttachmentMessage(attachment: FileAttachment): string {
  return ATTACHMENT_PREFIX + JSON.stringify(attachment)
}

export function isImageType(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export async function uploadFile(
  roomId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<FileAttachment> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('Arquivo muito grande. Maximo: ' + formatFileSize(MAX_FILE_SIZE))
  }

  if (!isAllowedType(file.type)) {
    throw new Error('Tipo de arquivo nao permitido: ' + (file.type || 'desconhecido') + '. Use imagens, PDF, documentos ou texto.')
  }

  const supabase = createClient()
  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const filePath = roomId + '/' + timestamp + '_' + safeName

  onProgress?.(10)

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    throw new Error('Erro no upload: ' + error.message)
  }

  onProgress?.(80)

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(data.path)

  onProgress?.(100)

  return {
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
    url: urlData.publicUrl,
  }
}
