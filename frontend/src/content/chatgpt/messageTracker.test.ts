// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMessageTracker } from './messageTracker'

const STABLE_MS = 1000

// MutationObserver delivers records on the microtask queue, which fake
// timers don't advance, so DOM mutations need an explicit flush before
// asserting on tracker callbacks.
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(resolve))
}

describe('createMessageTracker', () => {
  let root: HTMLDivElement
  let onUserMessage: ReturnType<typeof vi.fn<(text: string) => void>>
  let onAssistantMessage: ReturnType<typeof vi.fn<(text: string) => void>>

  beforeEach(() => {
    vi.useFakeTimers()
    root = document.createElement('div')
    document.body.appendChild(root)
    onUserMessage = vi.fn<(text: string) => void>()
    onAssistantMessage = vi.fn<(text: string) => void>()
  })

  afterEach(() => {
    root.remove()
    vi.useRealTimers()
  })

  function addMessage(role: 'user' | 'assistant', text: string): HTMLDivElement {
    const el = document.createElement('div')
    el.setAttribute('data-message-author-role', role)
    el.textContent = text
    root.appendChild(el)
    return el
  }

  it('reports a user message immediately, exactly once', async () => {
    createMessageTracker(root, { onUserMessage, onAssistantMessage }, STABLE_MS)

    addMessage('user', 'Hello there')
    await flushMicrotasks()

    // User messages don't wait for the stability window.
    expect(onUserMessage).toHaveBeenCalledTimes(1)
    expect(onUserMessage).toHaveBeenCalledWith('Hello there')

    vi.advanceTimersByTime(STABLE_MS * 2)
    expect(onUserMessage).toHaveBeenCalledTimes(1)
  })

  it('does not recount a user message if it mutates again after being seen', async () => {
    createMessageTracker(root, { onUserMessage, onAssistantMessage }, STABLE_MS)

    const el = addMessage('user', 'Hello there')
    await flushMicrotasks()
    el.textContent = 'Hello there (edited)'
    await flushMicrotasks()

    expect(onUserMessage).toHaveBeenCalledTimes(1)
    expect(onUserMessage).toHaveBeenCalledWith('Hello there')
  })

  it('waits for an assistant message to stop changing before counting it once', async () => {
    createMessageTracker(root, { onUserMessage, onAssistantMessage }, STABLE_MS)

    const el = addMessage('assistant', 'Hel')
    await flushMicrotasks()
    expect(onAssistantMessage).not.toHaveBeenCalled()

    // Simulate streaming: content keeps changing, resetting the stability timer.
    vi.advanceTimersByTime(STABLE_MS - 200)
    el.textContent = 'Hello'
    await flushMicrotasks()
    vi.advanceTimersByTime(STABLE_MS - 200)
    el.textContent = 'Hello world'
    await flushMicrotasks()
    expect(onAssistantMessage).not.toHaveBeenCalled()

    // Content goes quiet for the full stability window.
    vi.advanceTimersByTime(STABLE_MS)
    expect(onAssistantMessage).toHaveBeenCalledTimes(1)
    expect(onAssistantMessage).toHaveBeenCalledWith('Hello world')

    // Further quiet time must not trigger a second count.
    vi.advanceTimersByTime(STABLE_MS * 3)
    expect(onAssistantMessage).toHaveBeenCalledTimes(1)
  })

  it('does not recount an assistant message that changes after completion', async () => {
    createMessageTracker(root, { onUserMessage, onAssistantMessage }, STABLE_MS)

    const el = addMessage('assistant', 'Final answer')
    await flushMicrotasks()
    vi.advanceTimersByTime(STABLE_MS)
    expect(onAssistantMessage).toHaveBeenCalledTimes(1)

    el.textContent = 'Final answer, edited later'
    await flushMicrotasks()
    vi.advanceTimersByTime(STABLE_MS)
    expect(onAssistantMessage).toHaveBeenCalledTimes(1)
  })

  it('tracks user and assistant messages independently across a conversation', async () => {
    createMessageTracker(root, { onUserMessage, onAssistantMessage }, STABLE_MS)

    addMessage('user', 'What is 2+2?')
    const reply = addMessage('assistant', '4')
    await flushMicrotasks()
    vi.advanceTimersByTime(STABLE_MS)

    addMessage('user', 'And 3+3?')
    reply.textContent = '4, and 3+3 is 6'
    addMessage('assistant', '6')
    await flushMicrotasks()
    vi.advanceTimersByTime(STABLE_MS)

    expect(onUserMessage).toHaveBeenCalledTimes(2)
    expect(onAssistantMessage).toHaveBeenCalledTimes(2)
    expect(onAssistantMessage).toHaveBeenNthCalledWith(1, '4')
    expect(onAssistantMessage).toHaveBeenNthCalledWith(2, '6')
  })

  it('ignores empty message elements', async () => {
    createMessageTracker(root, { onUserMessage, onAssistantMessage }, STABLE_MS)

    addMessage('user', '   ')
    addMessage('assistant', '')
    await flushMicrotasks()
    vi.advanceTimersByTime(STABLE_MS)

    expect(onUserMessage).not.toHaveBeenCalled()
    expect(onAssistantMessage).not.toHaveBeenCalled()
  })

  it('stops observing after disconnect', async () => {
    const tracker = createMessageTracker(root, { onUserMessage, onAssistantMessage }, STABLE_MS)
    tracker.disconnect()

    addMessage('user', 'After disconnect')
    await flushMicrotasks()
    vi.advanceTimersByTime(STABLE_MS)

    expect(onUserMessage).not.toHaveBeenCalled()
  })
})
