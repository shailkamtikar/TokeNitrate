import { getEncoder } from './encoder'

/**
 * Estimates the number of tokens in `text` using the o200k_base BPE
 * encoding. This is an approximation of OpenAI's tokenizer behavior, not
 * an official ChatGPT token/quota count.
 */
export function countTokens(text: string): number {
  if (!text) return 0
  return getEncoder().encode(text).length
}
