import { Tiktoken } from 'js-tiktoken/lite'
import o200kBase from 'js-tiktoken/ranks/o200k_base'

// o200k_base is the tiktoken encoding used by GPT-5-family and GPT-4o-family
// models. Isolated here so the encoding can be swapped without touching
// anything that calls countTokens().
let cachedEncoder: Tiktoken | null = null

export function getEncoder(): Tiktoken {
  if (!cachedEncoder) {
    cachedEncoder = new Tiktoken(o200kBase)
  }
  return cachedEncoder
}
