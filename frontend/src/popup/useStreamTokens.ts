import { useEffect, useState } from 'react'
import { freshStreamTokens, getStreamUsage, subscribeToStreamUsage } from '../usage/streamStore'

/** Tokens of the reply being generated in `conversationId` right now (0 when idle). */
export function useStreamTokens(conversationId: string | null): number {
  const [tokens, setTokens] = useState(0)

  useEffect(() => {
    let cancelled = false
    getStreamUsage()
      .then((value) => {
        if (!cancelled) setTokens(freshStreamTokens(value, conversationId))
      })
      .catch(() => undefined)
    const unsubscribe = subscribeToStreamUsage((value) => {
      if (!cancelled) setTokens(freshStreamTokens(value, conversationId))
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [conversationId])

  return tokens
}
