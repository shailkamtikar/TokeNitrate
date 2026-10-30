// Records the moment ChatGPT itself told the user a usage limit was reached.
// It overrides our estimate for the rest of the usage window, because in that
// case the limit is certain regardless of what our numbers say.
const LIMIT_HIT_KEY = 'tokenitrate_limit_hit'

export interface LimitHit {
  at: number
  usedTokens: number
}

function isLimitHit(value: unknown): value is LimitHit {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.at === 'number' && Number.isFinite(v.at) && typeof v.usedTokens === 'number'
}

export async function getLimitHit(): Promise<LimitHit | null> {
  const result = await chrome.storage.local.get(LIMIT_HIT_KEY)
  const stored = result[LIMIT_HIT_KEY]
  return isLimitHit(stored) ? stored : null
}

export async function setLimitHit(hit: LimitHit): Promise<void> {
  await chrome.storage.local.set({ [LIMIT_HIT_KEY]: hit })
}

/** True if a limit was reported inside the current usage window. */
export function limitHitInWindow(hit: LimitHit | null, windowMs: number, now: number = Date.now()): boolean {
  return hit !== null && now - hit.at < windowMs && hit.at <= now + 60_000
}

export function subscribeToLimitHit(listener: (hit: LimitHit | null) => void): () => void {
  function handleChange(
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: chrome.storage.AreaName,
  ) {
    if (areaName !== 'local') return
    const change = changes[LIMIT_HIT_KEY]
    if (!change) return
    listener(isLimitHit(change.newValue) ? change.newValue : null)
  }
  chrome.storage.onChanged.addListener(handleChange)
  return () => chrome.storage.onChanged.removeListener(handleChange)
}
