import { describe, expect, it } from 'vitest'
import { parseWholeNumber } from './parseWholeNumber'

describe('parseWholeNumber', () => {
  it('parses digits', () => expect(parseWholeNumber(' 1200 ')).toBe(1200))
  it('treats blank as not set', () => expect(parseWholeNumber('  ')).toBeNull())
  it('rejects decimals, negatives and text', () => {
    expect(parseWholeNumber('1.5')).toBe('invalid')
    expect(parseWholeNumber('-5')).toBe('invalid')
    expect(parseWholeNumber('abc')).toBe('invalid')
    expect(parseWholeNumber('1e3')).toBe('invalid')
  })
})
