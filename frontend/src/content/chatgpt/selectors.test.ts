// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { CHATGPT_SELECTORS, extractMessageId, findComposer, getMessageRole } from './selectors'

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

describe('current ChatGPT layout (no data-message-author-role)', () => {
  function assistantBubble(id: string, text: string): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.setAttribute('data-chatgpt-selection-message-id', id)
    const markdown = document.createElement('div')
    markdown.setAttribute('data-markdown-text-style', 'assistant-message')
    markdown.textContent = text
    wrapper.appendChild(markdown)
    document.body.appendChild(wrapper)
    return markdown
  }

  function userBubble(id: string, text: string): HTMLElement {
    const unit = document.createElement('div')
    unit.setAttribute('data-chatgpt-search-message-ids', `${id} extra-id`)
    const bubble = document.createElement('div')
    bubble.setAttribute('data-user-message-bubble', 'true')
    bubble.textContent = text
    unit.appendChild(bubble)
    document.body.appendChild(unit)
    return bubble
  }

  it('matches user and assistant messages with the newer selectors', () => {
    const user = userBubble('u-1', 'hi')
    const assistant = assistantBubble('a-1', 'Hey!')
    expect(user.matches(CHATGPT_SELECTORS.userMessage)).toBe(true)
    expect(assistant.matches(CHATGPT_SELECTORS.assistantMessage)).toBe(true)
    expect(getMessageRole(user)).toBe('user')
    expect(getMessageRole(assistant)).toBe('assistant')
  })

  it('reads the id from an ancestor for assistant messages', () => {
    expect(extractMessageId(assistantBubble('a-2', 'Hello'), 0)).toBe('a-2')
  })

  it('reads the first id from a multi-id ancestor for user messages', () => {
    expect(extractMessageId(userBubble('u-2', 'Hello'), 0)).toBe('u-2')
  })
})

describe('findComposer', () => {
  it('finds a contenteditable textbox composer', () => {
    document.body.innerHTML = '<div contenteditable="true" role="textbox" aria-label="Ask ChatGPT"></div>'
    expect(findComposer()).not.toBeNull()
  })

  it('finds a plain textarea composer', () => {
    document.body.innerHTML = '<textarea name="prompt"></textarea>'
    expect(findComposer()?.tagName).toBe('TEXTAREA')
  })

  it('returns null when there is no composer', () => {
    document.body.innerHTML = '<p>nothing</p>'
    expect(findComposer()).toBeNull()
  })
})
