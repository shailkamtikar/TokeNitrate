import { useEffect, useState } from 'react'
import { EMPTY_CONVERSATION_USAGE, type ConversationUsage } from '../usage/conversationModel'
import {
  getActiveConversation,
  getConversationUsage,
  subscribeToActiveConversation,
  subscribeToConversationUsage,
} from '../usage/conversationUsageStore'

export interface ConversationContext {
  conversationId: string | null
  usage: ConversationUsage
}

const EMPTY_CONTEXT: ConversationContext = {
  conversationId: null,
  usage: EMPTY_CONVERSATION_USAGE,
}

/**
 * Tracks whichever ChatGPT conversation is currently active (per the
 * content script) and keeps that conversation's usage live while the
 * popup is open. Resolves to `conversationId: null` if no ChatGPT
 * conversation has been identified yet (e.g. a fresh new-chat page).
 */
export function useConversationUsage(): ConversationContext {
  const [context, setContext] = useState<ConversationContext>(EMPTY_CONTEXT)

  useEffect(() => {
    let cancelled = false
    let unsubscribeUsage: (() => void) | null = null
    // Bumped on every attach() call and captured per-call, so a
    // getConversationUsage() read that was already in flight when the
    // active conversation changes again can't overwrite the newer
    // conversation's data if it happens to resolve later (e.g. the active
    // pointer flips A -> B -> A again in quick succession, or flips twice
    // while the popup is mounting).
    let requestId = 0

    function attach(conversationId: string | null): void {
      const thisRequestId = ++requestId

      unsubscribeUsage?.()
      unsubscribeUsage = null

      if (!conversationId) {
        if (!cancelled) setContext({ conversationId: null, usage: EMPTY_CONVERSATION_USAGE })
        return
      }

      getConversationUsage(conversationId).then((usage) => {
        if (!cancelled && thisRequestId === requestId) setContext({ conversationId, usage })
      })

      unsubscribeUsage = subscribeToConversationUsage(conversationId, (usage) => {
        if (!cancelled && thisRequestId === requestId) setContext({ conversationId, usage })
      })
    }

    getActiveConversation().then((pointer) => {
      if (!cancelled) attach(pointer.conversationId)
    })

    const unsubscribeActive = subscribeToActiveConversation((pointer) => {
      attach(pointer.conversationId)
    })

    return () => {
      cancelled = true
      unsubscribeActive()
      unsubscribeUsage?.()
    }
  }, [])

  return context
}
