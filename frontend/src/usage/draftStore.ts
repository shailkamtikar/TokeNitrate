// The live draft count, shared from the ChatGPT tab to the popup. Only
// numbers are stored here — never the draft text — and the record is
// ignored once it is older than DRAFT_STALE_MS (e.g. the tab was closed).
const DRAFT_KEY = 'tokenitrate_draft'

export const DRAFT_STALE_MS = 10 * 60 * 1000

export interface DraftUsage {
  conversationId: string | null
  tokens: number
  fileTokens: number
  updatedAt: number
}

export const EMPTY_DRAFT: DraftUsage = {
  conversationId: null,
  tokens: 0,
  fileTokens: 0,
  updatedAt: 0,
}

export async function setDraftUsage(draft: DraftUsage): Promise<void> {
  if (draft.tokens <= 0 && draft.fileTokens <= 0) {
    await chrome.storage.local.remove(DRAFT_KEY)
    return
  }
  await chrome.storage.local.set({ [DRAFT_KEY]: draft })
}

export async function clearDraftUsage(): Promise<void> {
  await chrome.storage.local.remove(DRAFT_KEY)
}

/** Returns the draft if it belongs to `conversationId` and is still fresh, otherwise the empty draft. */
export function freshDraftFor(
  draft: DraftUsage | undefined,
  conversationId: string | null,
  now: number = Date.now(),
): DraftUsage {
  if (!draft) return EMPTY_DRAFT
  if (now - draft.updatedAt > DRAFT_STALE_MS) return EMPTY_DRAFT
  if (draft.conversationId !== conversationId) return EMPTY_DRAFT
  return draft
}

export async function getDraftUsage(): Promise<DraftUsage | undefined> {
  const result = await chrome.storage.local.get(DRAFT_KEY)
  return result[DRAFT_KEY] as DraftUsage | undefined
}

export function subscribeToDraftUsage(listener: (draft: DraftUsage | undefined) => void): () => void {
  function handleChange(
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: chrome.storage.AreaName,
  ) {
    if (areaName !== 'local') return
    const change = changes[DRAFT_KEY]
    if (!change) return
    listener(change.newValue as DraftUsage | undefined)
  }
  chrome.storage.onChanged.addListener(handleChange)
  return () => chrome.storage.onChanged.removeListener(handleChange)
}
