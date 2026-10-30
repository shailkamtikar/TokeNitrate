// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeChromeStorage, type FakeChromeStorageHandle } from '../../testUtils/fakeChromeStorage'
import { getLedger } from '../../usage/tokenLedger'
import { startConversationSync, type ConversationSyncHandle } from './conversationSync'

const STABLE_MS = 50

function addUser(root: HTMLElement, id: string, text: string): void {
  const el = document.createElement('div')
  el.setAttribute('data-message-author-role', 'user')
  el.setAttribute('data-message-id', id)
  el.textContent = text
  root.appendChild(el)
}

function addAssistant(root: HTMLElement, id: string, text: string): void {
  const el = document.createElement('div')
  el.setAttribute('data-message-author-role', 'assistant')
  el.setAttribute('data-message-id', id)
  el.textContent = text
  root.appendChild(el)
}

async function settle(): Promise<void> {
  await Promise.resolve()
  vi.advanceTimersByTime(STABLE_MS)
  for (let i = 0; i < 60; i++) await Promise.resolve()
}

describe('usage ledger is fed by live activity only', () => {
  let storage: FakeChromeStorageHandle
  let root: HTMLDivElement
  let handle: ConversationSyncHandle | null

  beforeEach(() => {
    vi.useFakeTimers()
    storage = installFakeChromeStorage()
    root = document.createElement('div')
    document.body.appendChild(root)
    handle = null
  })
  afterEach(() => {
    handle?.disconnect()
    root.remove()
    storage.uninstall()
    vi.useRealTimers()
  })

  it('ignores history already on the page when a chat is opened', async () => {
    history.pushState({}, '', '/c/old-chat')
    addUser(root, 'h1', 'an old question')
    addAssistant(root, 'h2', 'an old answer')
    addUser(root, 'h3', 'another old question')
    handle = startConversationSync(root, STABLE_MS)
    await settle()
    expect(await getLedger()).toEqual([])
  })

  it('records a message sent after the chat was opened, and the reply', async () => {
    history.pushState({}, '', '/c/live-chat')
    addUser(root, 'h1', 'an old question')
    addAssistant(root, 'h2', 'an old answer')
    handle = startConversationSync(root, STABLE_MS)
    await settle()

    addUser(root, 'n1', 'a fresh live question')
    await settle()
    addAssistant(root, 'n2', 'a fresh live reply from the model')
    await settle()

    const kinds = (await getLedger()).map((e) => e.kind)
    expect(kinds).toContain('you')
    expect(kinds).toContain('chatgpt')
  })

  it('counts the first exchange of a brand-new chat as live, even though the URL only changes afterwards', async () => {
    history.pushState({}, '', '/') // landing page
    handle = startConversationSync(root, STABLE_MS)
    await settle()

    // The user sends the first message; ChatGPT shows the reply, and only then switches the URL.
    addUser(root, 'first', 'the very first message')
    addAssistant(root, 'first-reply', 'and the very first reply')
    History.prototype.pushState.call(history, {}, '', '/c/brand-new') // page-world navigation
    vi.advanceTimersByTime(400)
    await settle()

    const kinds = (await getLedger()).map((e) => e.kind)
    expect(kinds).toContain('you')
    expect(kinds).toContain('chatgpt')
  })

  it('does not treat a reloaded one-exchange chat as live', async () => {
    history.pushState({}, '', '/c/reloaded-chat') // opened directly, no landing page first
    addUser(root, 'u', 'an old question')
    addAssistant(root, 'a', 'an old answer')
    handle = startConversationSync(root, STABLE_MS)
    await settle()
    expect(await getLedger()).toEqual([])
  })

  it('follows a chat switch made by the page, without a reload', async () => {
    history.pushState({}, '', '/c/chat-a')
    handle = startConversationSync(root, STABLE_MS)
    await settle()

    root.innerHTML = ''
    History.prototype.pushState.call(history, {}, '', '/c/chat-b') // page-world navigation
    vi.advanceTimersByTime(400)
    await settle()
    addUser(root, 'b1', 'a message in chat b')
    await settle()

    const { getConversationUsage } = await import('../../usage/conversationUsageStore')
    expect((await getConversationUsage('chat-b')).inputTokens).toBeGreaterThan(0)
    expect((await getConversationUsage('chat-a')).inputTokens).toBe(0)
  })

  it('does not add to the ledger again after a refresh', async () => {
    history.pushState({}, '', '/c/refresh-chat')
    addUser(root, 'h1', 'seed')
    addAssistant(root, 'h2', 'seed reply')
    handle = startConversationSync(root, STABLE_MS)
    await settle()
    addUser(root, 'n1', 'sent live')
    await settle()
    const before = (await getLedger()).length

    handle.disconnect()
    root.innerHTML = ''
    addUser(root, 'h1', 'seed')
    addAssistant(root, 'h2', 'seed reply')
    addUser(root, 'n1', 'sent live')
    handle = startConversationSync(root, STABLE_MS)
    await settle()

    expect((await getLedger()).length).toBe(before)
  })
})
