/**
 * Cumulative token usage for a single ChatGPT conversation (a TokeNitrate
 * "session"). `estimatedContextTokens` is kept as its own field rather than
 * an alias for `totalTokens`: today it's computed the same way (sum of
 * tokenized visible user + assistant text), but they're different concepts
 * — `totalTokens` is an all-time observed total for the conversation, while
 * `estimatedContextTokens` is meant to approximate what's currently
 * contributing to the model's context, which a future version could model
 * differently (e.g. older messages falling out of a context window, or
 * contributions from files/images/tools). Keeping them separate now means
 * that later change won't require touching call sites that only care about
 * "current context usage".
 *
 * `countedMessageIds` is the durable dedupe record: it's what lets a page
 * refresh or returning to this conversation later re-scan its visible
 * history without adding those tokens a second time.
 */
export interface ConversationUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedContextTokens: number
  countedMessageIds: string[]
  lastUpdated: number
}

export const EMPTY_CONVERSATION_USAGE: ConversationUsage = {
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  estimatedContextTokens: 0,
  countedMessageIds: [],
  lastUpdated: 0,
}
