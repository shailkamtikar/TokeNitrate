// A provisional token count for the reply ChatGPT is generating right now.
// It lets the popup grow while the text streams in, instead of jumping only
// once the reply is finished. The finished reply is then counted for real
// (and deduplicated) by the normal tracker and this record is cleared.
const STREAM_KEY = 'tokenitrate_stream'

/** A stream record older than this is ignored (the tab was closed mid-reply, etc.). */
export const STREAM_STALE_MS = 20_000

export interface StreamUsage {
  conversationId: string | null
  tokens: number
  updatedAt: number
}

export const EMPTY_STREAM: StreamUsage = { conversationId: null, tokens: 0, updatedAt: 0 }

export async function setStreamUsage(stream: StreamUsage): Promise<void> {
  if (stream.tokens <= 0) {
    await chrome.storage.local.remove(STREAM_KEY)
    return
  }
  await chrome.storage.local.set({ [STREAM_KEY]: stream })
}

export async function clearStreamUsage(): Promise<void> {
  await chrome.storage.local.remove(STREAM_KEY)
}

/** The in-progress tokens for `conversationId`, or 0 if none, stale, or for another chat. */
export function freshStreamTokens(
  stream: StreamUsage | undefined,
  conversationId: string | null,
  now: number = Date.now(),
): number {
  if (!stream) return 0
  if (now - stream.updatedAt > STREAM_STALE_MS) return 0
  if (stream.conversationId !== conversationId) return 0
  return Math.max(0, stream.tokens)
}

export async function getStreamUsage(): Promise<StreamUsage | undefined> {
  const result = await chrome.storage.local.get(STREAM_KEY)
  return result[STREAM_KEY] as StreamUsage | undefined
}

export function subscribeToStreamUsage(listener: (stream: StreamUsage | undefined) => void): () => void {
  function handleChange(
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: chrome.storage.AreaName,
  ) {
    if (areaName !== 'local') return
    const change = changes[STREAM_KEY]
    if (!change) return
    listener(change.newValue as StreamUsage | undefined)
  }
  chrome.storage.onChanged.addListener(handleChange)
  return () => chrome.storage.onChanged.removeListener(handleChange)
}
