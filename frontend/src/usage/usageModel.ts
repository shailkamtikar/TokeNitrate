/**
 * Cumulative token usage estimates. `inputTokens`, `outputTokens`, and
 * `totalTokens` are populated today; the remaining fields are reserved so
 * future work (session windows, per-conversation totals, context-window
 * estimates, attachment estimates) can extend this model without breaking
 * existing storage or consumers.
 */
export interface UsageTotals {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  sessionTokens?: number
  conversationTokens?: number
  estimatedContextTokens?: number
  attachmentTokens?: number
}

export const EMPTY_USAGE: UsageTotals = {
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
}
