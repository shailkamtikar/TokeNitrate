import { describe, expect, it } from 'vitest'
import { countTokens } from './index'

describe('countTokens', () => {
  it('returns 0 for an empty string', () => {
    expect(countTokens('')).toBe(0)
  })

  it('counts a short English sentence', () => {
    expect(countTokens('Hello, world!')).toBeGreaterThan(0)
  })

  it('counts punctuation-heavy text', () => {
    expect(countTokens('Wait... what?! Really?')).toBeGreaterThan(0)
  })

  it('counts numbers', () => {
    expect(countTokens('The year is 2026 and pi is 3.14159.')).toBeGreaterThan(0)
  })

  it('counts multiline text as more tokens than a single line of it', () => {
    const singleLine = 'Line one.'
    const multiline = 'Line one.\nLine two.\nLine three.'
    expect(countTokens(multiline)).toBeGreaterThan(countTokens(singleLine))
  })

  it('counts a longer prompt', () => {
    const longPrompt = 'The quick brown fox jumps over the lazy dog. '.repeat(50)
    expect(countTokens(longPrompt)).toBeGreaterThan(100)
  })

  it('counts non-English text', () => {
    expect(countTokens('こんにちは世界')).toBeGreaterThan(0)
  })

  it('is deterministic for repeated calls with the same input', () => {
    const text = 'Determinism check: same input should yield the same count.'
    const first = countTokens(text)
    const second = countTokens(text)
    expect(first).toBe(second)
  })

  it('produces a larger count for longer text than shorter text', () => {
    expect(countTokens('Short.')).toBeLessThan(
      countTokens('This is a noticeably longer sentence than the short one.'),
    )
  })
})
