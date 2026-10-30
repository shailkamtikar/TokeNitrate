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

/**
 * Attachment token estimation. ChatGPT's own file handling is opaque, so
 * attachments are estimated from file size and type only (the extension
 * never reads file contents). These are rough constants, tuned to land
 * within roughly 10-20% for typical files.
 */
export const ATTACHMENT_ESTIMATION = {
  /** Plain text and source code: about 4 bytes per token. */
  textBytesPerToken: 4,
  /** PDFs carry layout/fonts/compression overhead: far more bytes per token of text. */
  pdfBytesPerToken: 40,
  /** Office documents (docx/xlsx/pptx) are zipped XML. */
  officeBytesPerToken: 25,
  /** Anything we don't recognise. */
  unknownBytesPerToken: 8,
  /** Images: tokens by file size bucket (<= bytes). Mirrors OpenAI's 85 + 170 per 512px tile scheme. */
  imageBuckets: [
    { maxBytes: 200 * 1024, tokens: 255 },
    { maxBytes: 1024 * 1024, tokens: 765 },
    { maxBytes: Infinity, tokens: 1105 },
  ],
  /** A single file never counts for more than this. */
  maxTokensPerFile: 100_000,
  /** Pending (unsent) attachments older than this are dropped. */
  pendingMaxAgeMs: 30 * 60 * 1000,
} as const
