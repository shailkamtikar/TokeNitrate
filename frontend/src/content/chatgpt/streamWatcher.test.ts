// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeChromeStorage, type FakeChromeStorageHandle } from '../../testUtils/fakeChromeStorage'
import { buildViewModel } from '../../popup/viewModel'
import { EMPTY_CONVERSATION_USAGE } from '../../usage/conversationModel'
import { DEFAULT_SETTINGS } from '../../settings/settingsStore'
import { freshStreamTokens, getStreamUsage, STREAM_STALE_MS } from '../../usage/streamStore'
import { createStreamWatcher, type StreamWatcher } from './streamWatcher'

function assistant(root: HTMLElement, text: string): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('data-markdown-text-style', 'assistant-message')
  el.textContent = text
  root.appendChild(el)
  return el
}

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}

describe('stream watcher', () => {
  let storage: FakeChromeStorageHandle
  let root: HTMLDivElement
  let watcher: StreamWatcher | null

  beforeEach(() => {
    vi.useFakeTimers()
    storage = installFakeChromeStorage()
    root = document.createElement('div')
    document.body.appendChild(root)
    history.pushState({}, '', '/c/stream-chat')
    watcher = null
  })
  afterEach(() => {
    watcher?.disconnect()
    root.remove()
    storage.uninstall()
    vi.useRealTimers()
  })

  it('publishes a growing token count while a reply streams in', async () => {
    const el = assistant(root, 'Hello')
    watcher = createStreamWatcher(root)

    el.textContent = 'Hello there, this is the beginning of a reply'
    await vi.advanceTimersByTimeAsync(300)
    await flush()
    const first = (await getStreamUsage())?.tokens ?? 0
    expect(first).toBeGreaterThan(0)

    el.textContent = 'Hello there, this is the beginning of a reply that keeps going and going for a while longer'
    await vi.advanceTimersByTimeAsync(300)
    await flush()
    expect((await getStreamUsage())?.tokens ?? 0).toBeGreaterThan(first)
  })

  it('does not treat a reply rendered all at once (history) as streaming', async () => {
    assistant(root, 'An old, fully rendered answer that was already on the page when it loaded.')
    watcher = createStreamWatcher(root)
    await vi.advanceTimersByTimeAsync(600)
    await flush()
    expect(await getStreamUsage()).toBeUndefined()
  })

  it('clears the provisional count once the reply has been counted', async () => {
    const el = assistant(root, 'Hi')
    watcher = createStreamWatcher(root)
    el.textContent = 'Hi there, a streaming reply that is now long enough'
    await vi.advanceTimersByTimeAsync(300)
    await flush()
    expect(await getStreamUsage()).toBeDefined()

    el.setAttribute('data-tokenitrate-counted', 'stream-chat')
    await vi.advanceTimersByTimeAsync(300)
    await flush()
    expect(await getStreamUsage()).toBeUndefined()
  })

  it('does nothing when there is no reply', async () => {
    watcher = createStreamWatcher(root)
    await vi.advanceTimersByTimeAsync(600)
    await flush()
    expect(await getStreamUsage()).toBeUndefined()
  })
})

describe('provisional stream tokens in the popup', () => {
  it('ignores stale or other-chat records', () => {
    const now = 1_000_000
    const record = { conversationId: 'a', tokens: 50, updatedAt: now }
    expect(freshStreamTokens(record, 'a', now + 1000)).toBe(50)
    expect(freshStreamTokens(record, 'b', now + 1000)).toBe(0)
    expect(freshStreamTokens(record, 'a', now + STREAM_STALE_MS + 1)).toBe(0)
    expect(freshStreamTokens(undefined, 'a', now)).toBe(0)
  })

  it('adds the live reply to the context meter and the usage window, and flags it as streaming', () => {
    const base = {
      conversation: { ...EMPTY_CONVERSATION_USAGE, estimatedContextTokens: 1000, outputTokens: 400 },
      draftTokens: 0,
      settings: DEFAULT_SETTINGS,
      ledger: [],
      observations: [],
      limitHit: null,
      now: 1_000_000,
    }
    const idle = buildViewModel(base)
    const live = buildViewModel({ ...base, streamTokens: 600 })
    expect(idle.context.streaming).toBe(false)
    expect(live.context.streaming).toBe(true)
    expect(live.context.tokens).toBe(1600)
    expect(live.context.chatgpt).toBe(1000)
    expect(live.usage.used).toBe(600)
  })
})
