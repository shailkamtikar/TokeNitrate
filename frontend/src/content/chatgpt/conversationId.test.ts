import { describe, expect, it } from 'vitest'
import { getConversationIdFromUrl } from './conversationId'

describe('getConversationIdFromUrl', () => {
  it('extracts the id from a standard conversation URL', () => {
    expect(getConversationIdFromUrl('https://chatgpt.com/c/abc-123-def')).toBe('abc-123-def')
  })

  it('extracts the id from the legacy chat.openai.com domain', () => {
    expect(getConversationIdFromUrl('https://chat.openai.com/c/abc-123-def')).toBe('abc-123-def')
  })

  it('extracts the id from a custom-GPT conversation URL', () => {
    expect(getConversationIdFromUrl('https://chatgpt.com/g/g-p-example/c/xyz-789')).toBe(
      'xyz-789',
    )
  })

  it('ignores query strings and trailing slashes', () => {
    expect(getConversationIdFromUrl('https://chatgpt.com/c/abc-123?model=gpt-5')).toBe('abc-123')
  })

  it('returns null for the new-chat landing page', () => {
    expect(getConversationIdFromUrl('https://chatgpt.com/')).toBeNull()
  })

  it('returns null for an unrelated ChatGPT page', () => {
    expect(getConversationIdFromUrl('https://chatgpt.com/settings')).toBeNull()
  })

  it('returns null for an invalid URL', () => {
    expect(getConversationIdFromUrl('not a url')).toBeNull()
  })

  it('is deterministic: the same URL always yields the same id', () => {
    const url = 'https://chatgpt.com/c/stable-id'
    expect(getConversationIdFromUrl(url)).toBe(getConversationIdFromUrl(url))
  })
})
