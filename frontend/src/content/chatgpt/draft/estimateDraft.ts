import { countTokens } from '../../../tokenizer'

/** Above this size, tokenizing on every pause would be noticeable. */
const APPROXIMATE_ABOVE_CHARS = 100_000
const APPROX_CHARS_PER_TOKEN = 4

/**
 * Token estimate for a draft. Exact for normal prompts; for a very large
 * paste it falls back to a chars/4 approximation so typing never stutters.
 */
export function estimateDraftTokens(text: string): { tokens: number; approximate: boolean } {
  if (!text) return { tokens: 0, approximate: false }
  if (text.length > APPROXIMATE_ABOVE_CHARS) {
    return { tokens: Math.ceil(text.length / APPROX_CHARS_PER_TOKEN), approximate: true }
  }
  return { tokens: countTokens(text), approximate: false }
}
