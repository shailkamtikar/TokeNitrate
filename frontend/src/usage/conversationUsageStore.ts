import { EMPTY_CONVERSATION_USAGE, type ConversationUsage } from './conversationModel'

// Per-conversation storage abstraction over chrome.storage.local, kept
// separate from usageStore.ts (the pre-existing all-time global aggregate)
// so neither concern has to know about the other. Nothing outside this file
// should read/write these keys directly.
const CONVERSATION_KEY_PREFIX = 'tokenitrate_conversation_'
const ACTIVE_CONVERSATION_KEY = 'tokenitrate_active_conversation'

function storageKey(conversationId: string): string {
  return `${CONVERSATION_KEY_PREFIX}${conversationId}`
}

// Serializes reads-then-writes per conversation so concurrent updates (e.g.
// a user message and an assistant message landing close together) don't
// clobber each other.
const writeQueues = new Map<string, Promise<unknown>>()

function enqueue<T>(conversationId: string, task: () => Promise<T>): Promise<T> {
  const previous = writeQueues.get(conversationId) ?? Promise.resolve()
  const result = previous.then(task)
  writeQueues.set(
    conversationId,
    result.then(
      () => undefined,
      () => undefined,
    ),
  )
  return result
}

export async function getConversationUsage(conversationId: string): Promise<ConversationUsage> {
  const key = storageKey(conversationId)
  const result = await chrome.storage.local.get(key)
  const stored = result[key] as ConversationUsage | undefined
  return stored ?? EMPTY_CONVERSATION_USAGE
}

/**
 * Atomically reads, updates, and persists one conversation's usage.
 * `updater` receives the current stored value (or the empty default for a
 * conversation seen for the first time) and must return the full next
 * value.
 */
export function updateConversationUsage(
  conversationId: string,
  updater: (current: ConversationUsage) => ConversationUsage,
): Promise<ConversationUsage> {
  const key = storageKey(conversationId)
  return enqueue(conversationId, async () => {
    const result = await chrome.storage.local.get(key)
    const current = (result[key] as ConversationUsage | undefined) ?? EMPTY_CONVERSATION_USAGE
    const next = updater(current)
    await chrome.storage.local.set({ [key]: next })
    return next
  })
}

export function subscribeToConversationUsage(
  conversationId: string,
  listener: (usage: ConversationUsage) => void,
): () => void {
  const key = storageKey(conversationId)
  function handleChange(
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: chrome.storage.AreaName,
  ) {
    if (areaName !== 'local') return
    const change = changes[key]
    if (!change) return
    listener((change.newValue as ConversationUsage | undefined) ?? EMPTY_CONVERSATION_USAGE)
  }
  chrome.storage.onChanged.addListener(handleChange)
  return () => chrome.storage.onChanged.removeListener(handleChange)
}

/**
 * Which ChatGPT conversation (if any) is currently active. Written by the
 * content script whenever it identifies or switches conversations, and
 * read by the popup so it knows which conversation's usage to display
 * without needing its own access to the ChatGPT tab.
 */
export interface ActiveConversationPointer {
  conversationId: string | null
  updatedAt: number
}

const EMPTY_ACTIVE_CONVERSATION: ActiveConversationPointer = {
  conversationId: null,
  updatedAt: 0,
}

export async function setActiveConversation(conversationId: string | null): Promise<void> {
  const pointer: ActiveConversationPointer = { conversationId, updatedAt: Date.now() }
  await chrome.storage.local.set({ [ACTIVE_CONVERSATION_KEY]: pointer })
}

export async function getActiveConversation(): Promise<ActiveConversationPointer> {
  const result = await chrome.storage.local.get(ACTIVE_CONVERSATION_KEY)
  return (
    (result[ACTIVE_CONVERSATION_KEY] as ActiveConversationPointer | undefined) ??
    EMPTY_ACTIVE_CONVERSATION
  )
}

export function subscribeToActiveConversation(
  listener: (pointer: ActiveConversationPointer) => void,
): () => void {
  function handleChange(
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: chrome.storage.AreaName,
  ) {
    if (areaName !== 'local') return
    const change = changes[ACTIVE_CONVERSATION_KEY]
    if (!change) return
    listener((change.newValue as ActiveConversationPointer | undefined) ?? EMPTY_ACTIVE_CONVERSATION)
  }
  chrome.storage.onChanged.addListener(handleChange)
  return () => chrome.storage.onChanged.removeListener(handleChange)
}

/** Conversations untouched for this long are removed to keep storage small. */
export const CONVERSATION_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000

/** Deletes stored per-chat records not updated within CONVERSATION_MAX_AGE_MS. Returns how many were removed. */
export async function pruneStaleConversations(now: number = Date.now()): Promise<number> {
  const all = await chrome.storage.local.get(null)
  const stale = Object.entries(all)
    .filter(([key, value]) => {
      if (!key.startsWith(CONVERSATION_KEY_PREFIX)) return false
      const updated = (value as Partial<ConversationUsage> | undefined)?.lastUpdated
      return typeof updated === 'number' && updated > 0 && now - updated > CONVERSATION_MAX_AGE_MS
    })
    .map(([key]) => key)
  if (stale.length > 0) await chrome.storage.local.remove(stale)
  return stale.length
}
