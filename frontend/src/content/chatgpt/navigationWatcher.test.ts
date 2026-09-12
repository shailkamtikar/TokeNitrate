// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
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
})
