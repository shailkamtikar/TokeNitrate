import { useEffect, useState } from 'react'
import {
  EMPTY_DRAFT,
  freshDraftFor,
  getDraftUsage,
  subscribeToDraftUsage,
  type DraftUsage,
} from '../usage/draftStore'

/** The live draft count for `conversationId`, or an empty draft if none/stale/other chat. */
export function useDraftTokens(conversationId: string | null): DraftUsage {
  const [draft, setDraft] = useState<DraftUsage>(EMPTY_DRAFT)

  useEffect(() => {
    let cancelled = false
    getDraftUsage().then((value) => {
      if (!cancelled) setDraft(freshDraftFor(value, conversationId))
    })
    const unsubscribe = subscribeToDraftUsage((value) => {
      if (!cancelled) setDraft(freshDraftFor(value, conversationId))
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [conversationId])

  return draft
}
