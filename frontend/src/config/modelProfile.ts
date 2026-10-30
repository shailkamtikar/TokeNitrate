/**
 * TokeNitrate models exactly one ChatGPT profile: the free tier. Every number
 * here is our own estimate. OpenAI publishes neither the free-tier context
 * size nor a token budget for the usage window, so none of this is official,
 * and the UI always labels the derived figures as estimates.
 *
 * Keeping all tunable numbers in this file means no component, store or
 * calculation hard-codes them.
 */
export interface ModelProfile {
  name: string
  /** tiktoken encoding used to count tokens. */
  tokenizer: 'o200k_base'
  /** Estimated context size of a single chat, in tokens. */
  contextCapacityTokens: number
  /** Estimated tokens a free account can use per usage window, across all chats. */
  usageBudgetTokens: number
  /** Length of the rolling usage window. */
  usageWindowMs: number
}

export const FREE_TIER_PROFILE: ModelProfile = {
  name: 'ChatGPT Free',
  tokenizer: 'o200k_base',
  contextCapacityTokens: 16_000,
  usageBudgetTokens: 30_000,
  usageWindowMs: 5 * 60 * 60 * 1000,
}

/** Debounce for the live draft counter, in milliseconds. */
export const DRAFT_DEBOUNCE_MS = 150
