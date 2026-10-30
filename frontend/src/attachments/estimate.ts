import { ATTACHMENT_ESTIMATION } from '../config/modelProfile'

export interface AttachmentInfo {
  name: string
  type: string
  size: number
}

export type AttachmentKind = 'image' | 'pdf' | 'office' | 'text' | 'unknown'

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'log',
  'html', 'htm', 'css', 'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'h', 'cpp', 'hpp', 'cs',
  'go', 'rs', 'rb', 'php', 'sh', 'sql', 'swift', 'kt', 'r', 'tex',
])
const OFFICE_EXTENSIONS = new Set(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf'])
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'heic', 'heif', 'avif', 'svg'])

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
}

/** Classifies by MIME type first, then by file extension. */
export function classifyAttachment({ name, type }: Pick<AttachmentInfo, 'name' | 'type'>): AttachmentKind {
  const mime = type.toLowerCase()
  const ext = extensionOf(name)
  if (mime.startsWith('image/') || IMAGE_EXTENSIONS.has(ext)) return 'image'
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (mime.startsWith('text/') || mime === 'application/json' || TEXT_EXTENSIONS.has(ext)) return 'text'
  if (mime.includes('officedocument') || mime.includes('msword') || OFFICE_EXTENSIONS.has(ext)) return 'office'
  return 'unknown'
}

/**
 * Estimates the tokens an attachment adds to a message, from its size and
 * type only (file contents are never read). Deterministic and clamped, so
 * a bad size can never produce a negative, NaN or absurd result.
 */
export function estimateAttachmentTokens(file: AttachmentInfo): number {
  const size = Number.isFinite(file.size) && file.size > 0 ? file.size : 0
  if (size === 0) return 0

  const kind = classifyAttachment(file)
  let tokens: number
  switch (kind) {
    case 'image':
      tokens = ATTACHMENT_ESTIMATION.imageBuckets.find((b) => size <= b.maxBytes)!.tokens
      break
    case 'pdf':
      tokens = size / ATTACHMENT_ESTIMATION.pdfBytesPerToken
      break
    case 'office':
      tokens = size / ATTACHMENT_ESTIMATION.officeBytesPerToken
      break
    case 'text':
      tokens = size / ATTACHMENT_ESTIMATION.textBytesPerToken
      break
    default:
      tokens = size / ATTACHMENT_ESTIMATION.unknownBytesPerToken
  }
  return Math.min(ATTACHMENT_ESTIMATION.maxTokensPerFile, Math.max(1, Math.round(tokens)))
}
