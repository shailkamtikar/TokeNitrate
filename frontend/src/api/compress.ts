import type { CompressErrorCode, CompressResponse } from '../messaging/protocol'

/** Backend base URL. The Gemini key lives only on that server, never in the extension. */
export const BACKEND_URL = 'https://tokenitrate-api.onrender.com'
export const MAX_COMPRESS_CHARS = 20_000
const REQUEST_TIMEOUT_MS = 60_000

export interface CompressDeps {
  fetchFn: typeof fetch
  getClientId: () => Promise<string>
  baseUrl?: string
  timeoutMs?: number
}

const KNOWN_CODES: ReadonlySet<string> = new Set<CompressErrorCode>([
  'rate_limited',
  'quota_exhausted',
  'timeout',
  'not_configured',
  'upstream_error',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Sends `text` to the backend and returns a typed result. It never throws:
 * every failure becomes `{ ok: false, code }` so the UI can show a friendly
 * message for each case.
 */
export async function compressText(text: string, deps: CompressDeps): Promise<CompressResponse> {
  if (!text.trim()) return { ok: false, code: 'empty' }
  if (text.length > MAX_COMPRESS_CHARS) return { ok: false, code: 'too_long' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? REQUEST_TIMEOUT_MS)
  try {
    const response = await deps.fetchFn(`${deps.baseUrl ?? BACKEND_URL}/compress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client-Id': await deps.getClientId() },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    })

    let body: unknown
    try {
      body = await response.json()
    } catch {
      return { ok: false, code: 'invalid_response' }
    }

    if (!response.ok) {
      const code = isRecord(body) && typeof body.code === 'string' ? body.code : ''
      if (response.status === 422 && code === 'text_too_long') return { ok: false, code: 'too_long' }
      return { ok: false, code: KNOWN_CODES.has(code) ? (code as CompressErrorCode) : 'upstream_error' }
    }

    if (
      isRecord(body) &&
      typeof body.compressed === 'string' &&
      typeof body.original_chars === 'number' &&
      typeof body.compressed_chars === 'number' &&
      typeof body.unchanged === 'boolean'
    ) {
      return {
        ok: true,
        compressed: body.compressed,
        originalChars: body.original_chars,
        compressedChars: body.compressed_chars,
        unchanged: body.unchanged,
      }
    }
    return { ok: false, code: 'invalid_response' }
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError'
    return { ok: false, code: aborted ? 'timeout' : 'unreachable' }
  } finally {
    clearTimeout(timer)
  }
}

/** Friendly, user-facing text for each failure. */
export function describeCompressError(code: CompressErrorCode): string {
  switch (code) {
    case 'empty':
      return 'Type something in the ChatGPT message box first.'
    case 'too_long':
      return 'That draft is too long to shorten in one go (limit 20,000 characters).'
    case 'rate_limited':
      return 'You are shortening prompts very quickly. Wait a moment and try again.'
    case 'quota_exhausted':
      return 'Compression is temporarily unavailable (the free quota is used up). Try again later.'
    case 'timeout':
      return 'The model took too long to answer. Try again.'
    case 'unreachable':
      return 'Could not reach the TokeNitrate server. It may be waking up; try again in a moment.'
    case 'not_configured':
      return 'The compression service has no API key configured yet.'
    default:
      return 'Something went wrong while shortening the prompt. Try again.'
  }
}
