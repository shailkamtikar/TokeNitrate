import { afterEach, describe, expect, it } from 'vitest'
import { isExtensionContextInvalidatedError, isExtensionContextValid } from './extensionContext'

describe('isExtensionContextInvalidatedError', () => {
  it('matches the exact error Chrome throws on invalidation', () => {
    expect(isExtensionContextInvalidatedError(new Error('Extension context invalidated.'))).toBe(
      true,
    )
  })

  it('matches even if the message has extra surrounding text', () => {
    expect(
      isExtensionContextInvalidatedError(
        new Error('Uncaught Error: Extension context invalidated'),
      ),
    ).toBe(true)
  })

  it('does not match an unrelated Error', () => {
    expect(isExtensionContextInvalidatedError(new Error('QuotaExceededError'))).toBe(false)
  })

  it('still matches when the rejection is a plain string rather than an Error', () => {
    // Defensive: not every browser/context is guaranteed to reject with a
    // real Error instance for this failure.
    expect(isExtensionContextInvalidatedError('Extension context invalidated.')).toBe(true)
  })

  it('still matches a bare object with a matching message property', () => {
    expect(isExtensionContextInvalidatedError({ message: 'Extension context invalidated' })).toBe(
      true,
    )
  })

  it('does not match other non-Error values', () => {
    expect(isExtensionContextInvalidatedError('QuotaExceededError')).toBe(false)
    expect(isExtensionContextInvalidatedError({ message: 'QuotaExceededError' })).toBe(false)
    expect(isExtensionContextInvalidatedError({ message: 42 })).toBe(false)
    expect(isExtensionContextInvalidatedError(null)).toBe(false)
    expect(isExtensionContextInvalidatedError(undefined)).toBe(false)
    expect(isExtensionContextInvalidatedError(42)).toBe(false)
  })
})

describe('isExtensionContextValid', () => {
  const previousChrome = (globalThis as { chrome?: unknown }).chrome

  afterEach(() => {
    ;(globalThis as { chrome?: unknown }).chrome = previousChrome
  })

  it('is true when chrome.runtime.id is a string', () => {
    ;(globalThis as { chrome?: unknown }).chrome = { runtime: { id: 'abc123' } }
    expect(isExtensionContextValid()).toBe(true)
  })

  it('is false when chrome.runtime.id is undefined (invalidated)', () => {
    ;(globalThis as { chrome?: unknown }).chrome = { runtime: { id: undefined } }
    expect(isExtensionContextValid()).toBe(false)
  })

  it('is false when chrome is missing entirely', () => {
    ;(globalThis as { chrome?: unknown }).chrome = undefined
    expect(isExtensionContextValid()).toBe(false)
  })

  it('is false when accessing chrome.runtime throws', () => {
    ;(globalThis as { chrome?: unknown }).chrome = {
      get runtime(): never {
        throw new Error('boom')
      },
    }
    expect(isExtensionContextValid()).toBe(false)
  })
})
