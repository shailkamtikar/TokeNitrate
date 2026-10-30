// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { onLocationChange } from './navigationWatcher'

describe('onLocationChange', () => {
  it('notifies on pushState with the new URL', () => {
    const listener = vi.fn()
    const unsubscribe = onLocationChange(listener)

    history.pushState({}, '', '/c/conversation-a')

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0][0]).toContain('/c/conversation-a')

    unsubscribe()
  })

  it('notifies on replaceState with the new URL', () => {
    const listener = vi.fn()
    const unsubscribe = onLocationChange(listener)

    history.replaceState({}, '', '/c/conversation-b')

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0][0]).toContain('/c/conversation-b')

    unsubscribe()
  })

  it('does not notify when the URL does not actually change', () => {
    history.pushState({}, '', '/c/conversation-c')
    const listener = vi.fn()
    const unsubscribe = onLocationChange(listener)

    history.pushState({}, '', '/c/conversation-c')

    expect(listener).not.toHaveBeenCalled()

    unsubscribe()
  })

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn()
    const unsubscribe = onLocationChange(listener)
    unsubscribe()

    history.pushState({}, '', '/c/conversation-d')

    expect(listener).not.toHaveBeenCalled()
  })

  it('notifies on browser back/forward navigation (popstate)', async () => {
    history.pushState({}, '', '/c/conversation-e')
    const listener = vi.fn()
    const unsubscribe = onLocationChange(listener)

    history.pushState({}, '', '/c/conversation-f')
    expect(listener).toHaveBeenCalledTimes(1)

    history.back()

    await vi.waitFor(() => {
      expect(listener).toHaveBeenCalledTimes(2)
    })
    expect(listener.mock.calls[1][0]).toContain('/c/conversation-e')

    unsubscribe()
  })

  describe('page-world navigation (the content script runs in an isolated world)', () => {
    afterEach(() => vi.useRealTimers())

    /** Calls the real History.prototype method, bypassing our wrapper, like ChatGPT's own page code does. */
    function pageWorldPushState(url: string): void {
      History.prototype.pushState.call(history, {}, '', url)
    }

    it('detects a URL change that bypasses our pushState wrapper', () => {
      vi.useFakeTimers()
      history.pushState({}, '', '/')
      const listener = vi.fn()
      const unsubscribe = onLocationChange(listener)

      pageWorldPushState('/c/new-chat-after-first-message')
      expect(listener).not.toHaveBeenCalled() // wrapper never saw it

      vi.advanceTimersByTime(400)
      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener.mock.calls[0][0]).toContain('/c/new-chat-after-first-message')
      unsubscribe()
    })

    it('detects replaceState from the page world too', () => {
      vi.useFakeTimers()
      history.pushState({}, '', '/c/start')
      const listener = vi.fn()
      const unsubscribe = onLocationChange(listener)

      History.prototype.replaceState.call(history, {}, '', '/c/swapped')
      vi.advanceTimersByTime(400)
      expect(listener).toHaveBeenCalledTimes(1)
      unsubscribe()
    })

    it('notifies once per change even when several routes fire', () => {
      vi.useFakeTimers()
      history.pushState({}, '', '/c/one')
      const listener = vi.fn()
      const unsubscribe = onLocationChange(listener)

      history.pushState({}, '', '/c/two') // wrapper notifies
      vi.advanceTimersByTime(1000) // poll must not notify again
      expect(listener).toHaveBeenCalledTimes(1)
      unsubscribe()
    })

    it('stops polling once nobody is listening', () => {
      vi.useFakeTimers()
      const unsubscribe = onLocationChange(() => undefined)
      unsubscribe()
      expect(vi.getTimerCount()).toBe(0)
    })
  })
})
