import { EMPTY_USAGE, type UsageTotals } from './usageModel'

// Storage abstraction over chrome.storage.local. Nothing outside this file
// should call the chrome.storage APIs directly, so the backing store can be
// swapped later without touching callers.
const STORAGE_KEY = 'tokenitrate_usage'

// Serializes reads-then-writes so an input count and an output count
// arriving close together don't clobber each other.
let writeQueue: Promise<unknown> = Promise.resolve()

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(task)
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}

export async function getUsage(): Promise<UsageTotals> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  const stored = result[STORAGE_KEY] as UsageTotals | undefined
  return stored ?? EMPTY_USAGE
}

function withAddedTokens(
  current: UsageTotals,
  field: 'inputTokens' | 'outputTokens',
  count: number,
): UsageTotals {
  const next = { ...current, [field]: current[field] + count }
  next.totalTokens = next.inputTokens + next.outputTokens
  return next
}

async function addTokens(
  field: 'inputTokens' | 'outputTokens',
  count: number,
): Promise<UsageTotals> {
  if (!Number.isFinite(count) || count <= 0) {
    return getUsage()
  }
  return enqueue(async () => {
    const current = await getUsage()
    const next = withAddedTokens(current, field, count)
    await chrome.storage.local.set({ [STORAGE_KEY]: next })
    return next
  })
}

export function addInputTokens(count: number): Promise<UsageTotals> {
  return addTokens('inputTokens', count)
}

export function addOutputTokens(count: number): Promise<UsageTotals> {
  return addTokens('outputTokens', count)
}

/** Subscribes to usage changes; returns an unsubscribe function. */
export function subscribeToUsage(listener: (usage: UsageTotals) => void): () => void {
  function handleChange(
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: chrome.storage.AreaName,
  ) {
    if (areaName !== 'local') return
    const change = changes[STORAGE_KEY]
    if (!change) return
    listener((change.newValue as UsageTotals | undefined) ?? EMPTY_USAGE)
  }

  chrome.storage.onChanged.addListener(handleChange)
  return () => chrome.storage.onChanged.removeListener(handleChange)
}
