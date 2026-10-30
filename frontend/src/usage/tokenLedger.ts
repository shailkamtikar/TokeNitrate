// An account-wide, time-stamped log of estimated tokens used across every
// ChatGPT chat: what you typed, what you attached, and what ChatGPT wrote
// back. It powers the "usage limit" meter, which measures tokens inside a
// rolling window. Numbers only: no message text is ever stored here.
const LEDGER_KEY = 'tokenitrate_ledger'

/** Entries older than this are always discarded, whatever the window setting. */
export const LEDGER_MAX_AGE_MS = 24 * 60 * 60 * 1000
const LEDGER_MAX_ENTRIES = 5000

export type LedgerKind = 'you' | 'files' | 'chatgpt'

export interface LedgerEntry {
  t: number
  kind: LedgerKind
  tokens: number
}

export interface WindowUsage {
  total: number
  you: number
  files: number
  chatgpt: number
}

function isEntry(value: unknown): value is LedgerEntry {
  if (!value || typeof value !== 'object') return false
  const e = value as Record<string, unknown>
  return (
    typeof e.t === 'number' &&
    Number.isFinite(e.t) &&
    typeof e.tokens === 'number' &&
    Number.isFinite(e.tokens) &&
    e.tokens > 0 &&
    (e.kind === 'you' || e.kind === 'files' || e.kind === 'chatgpt')
  )
}

/** Keeps only well-formed, recent entries (also protects against corrupt storage). */
export function sanitizeLedger(raw: unknown, now: number = Date.now()): LedgerEntry[] {
  if (!Array.isArray(raw)) return []
  const cutoff = now - LEDGER_MAX_AGE_MS
  return raw
    .filter(isEntry)
    .filter((e) => e.t >= cutoff)
    .slice(-LEDGER_MAX_ENTRIES)
}

export function tokensInWindow(
  entries: LedgerEntry[],
  windowMs: number,
  now: number = Date.now(),
): WindowUsage {
  const usage: WindowUsage = { total: 0, you: 0, files: 0, chatgpt: 0 }
  const cutoff = now - windowMs
  for (const e of entries) {
    if (e.t < cutoff || e.t > now + 60_000) continue
    usage[e.kind] += e.tokens
    usage.total += e.tokens
  }
  return usage
}

/** When the oldest usage still inside the window drops out of it, or null if there is none. */
export function nextFreeUpAt(
  entries: LedgerEntry[],
  windowMs: number,
  now: number = Date.now(),
): number | null {
  const cutoff = now - windowMs
  let oldest: number | null = null
  for (const e of entries) {
    if (e.t < cutoff) continue
    if (oldest === null || e.t < oldest) oldest = e.t
  }
  return oldest === null ? null : oldest + windowMs
}

let writeQueue: Promise<unknown> = Promise.resolve()

export async function getLedger(now: number = Date.now()): Promise<LedgerEntry[]> {
  const result = await chrome.storage.local.get(LEDGER_KEY)
  return sanitizeLedger(result[LEDGER_KEY], now)
}

/** Appends entries (ignoring non-positive amounts). Writes are serialized. */
export function appendToLedger(
  additions: Array<{ kind: LedgerKind; tokens: number }>,
  now: number = Date.now(),
): Promise<LedgerEntry[]> {
  const fresh = additions
    .filter((a) => Number.isFinite(a.tokens) && a.tokens > 0)
    .map((a) => ({ t: now, kind: a.kind, tokens: Math.round(a.tokens) }))
  const task = async (): Promise<LedgerEntry[]> => {
    const current = await getLedger(now)
    if (fresh.length === 0) return current
    const next = [...current, ...fresh].slice(-LEDGER_MAX_ENTRIES)
    await chrome.storage.local.set({ [LEDGER_KEY]: next })
    return next
  }
  const result = writeQueue.then(task)
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}

export function subscribeToLedger(listener: (entries: LedgerEntry[]) => void): () => void {
  function handleChange(
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: chrome.storage.AreaName,
  ) {
    if (areaName !== 'local') return
    const change = changes[LEDGER_KEY]
    if (!change) return
    listener(sanitizeLedger(change.newValue))
  }
  chrome.storage.onChanged.addListener(handleChange)
  return () => chrome.storage.onChanged.removeListener(handleChange)
}
