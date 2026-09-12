// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { extractMessageId } from './selectors'

function makeMessage(role: string, text: string, nativeId?: string): HTMLDivElement {
  const el = document.createElement('div')
  el.setAttribute('data-message-author-role', role)
  if (nativeId) el.setAttribute('data-message-id', nativeId)
  el.textContent = text
  return el
}

describe('extractMessageId', () => {
  it('prefers the native data-message-id when present', () => {
    const el = makeMessage('user', 'Hello', 'native-123')
    expect(extractMessageId(el, 0)).toBe('native-123')
  })

  it('is deterministic for the same element and index', () => {
    const el = makeMessage('user', 'Hello there')
    expect(extractMessageId(el, 0)).toBe(extractMessageId(el, 0))
  })

  it('differs for messages with different text at the same role and position', () => {
    // Regression: a purely positional fallback id (role + index) collides
    // whenever an earlier same-role message is no longer present at scan
    // time (e.g. a re-render), letting a genuinely new message land at the
    // same position and be mistaken for the one already recorded there.
    const first = makeMessage('user', 'Hello there')
    const second = makeMessage('user', 'A completely different message')
    expect(extractMessageId(first, 0)).not.toBe(extractMessageId(second, 0))
  })

  it('differs for different roles at the same index', () => {
    const user = makeMessage('user', 'Same text')
    const assistant = makeMessage('assistant', 'Same text')
    expect(extractMessageId(user, 0)).not.toBe(extractMessageId(assistant, 0))
  })

  it('produces the same fallback id for identical role, index, and text', () => {
    // Documented residual limit: two truly identical messages at the same
    // position are indistinguishable without a real id.
    const a = makeMessage('user', 'Repeated message')
    const b = makeMessage('user', 'Repeated message')
    expect(extractMessageId(a, 0)).toBe(extractMessageId(b, 0))
  })
})
