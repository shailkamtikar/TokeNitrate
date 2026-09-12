// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeChromeStorage, type FakeChromeStorageHandle } from '../../testUtils/fakeChromeStorage'
import { getActiveConversation, getConversationUsage } from '../../usage/conversationUsageStore'
import { getUsage } from '../../usage/usageStore'
import { startConversationSync, type ConversationSyncHandle } from './conversationSync'

const STABLE_MS = 50

function addMessage(
  root: HTMLElement,
  role: 'user' | 'assistant',
  text: string,
  id: string,
): HTMLDivElement {
  const el = document.createElement('div')
  el.setAttribute('data-message-author-role', role)
  el.setAttribute('data-message-id', id)
  el.textContent = text
  root.appendChild(el)
  return el
}

/** No data-message-id — exercises the positional/content fallback identity. */
function addMessageWithoutId(
  root: HTMLElement,
  role: 'user' | 'assistant',
  text: string,
): HTMLDivElement {
  const el = document.createElement('div')
  el.setAttribute('data-message-author-role', role)
  el.textContent = text
  root.appendChild(el)
  return el
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(resolve))
}

async function settle(): Promise<void> {
  await flushMicrotasks()
  vi.advanceTimersByTime(STABLE_MS)
  // Recording a message chains several awaited storage round-trips
  // (conversation store, then the global aggregate), so give the
  // microtask queue several turns to drain them all.
  for (let i = 0; i < 10; i++) {
    await flushMicrotasks()
  }
}

describe('startConversationSync', () => {
  let storage: FakeChromeStorageHandle
  let root: HTMLDivElement
  let handle: ConversationSyncHandle | null

  beforeEach(() => {
    vi.useFakeTimers()
    storage = installFakeChromeStorage()
    root = document.createElement('div')
    document.body.appendChild(root)
    handle = null
    history.pushState({}, '', '/')
  })

  afterEach(() => {
    handle?.disconnect()
    root.remove()
    storage.uninstall()
    vi.useRealTimers()
  })

  it('starts a new conversation with zero usage', async () => {
    history.pushState({}, '', '/c/conv-new')
    handle = startConversationSync(root, STABLE_MS)
    await settle()

    const usage = await getConversationUsage('conv-new')
    expect(usage.inputTokens).toBe(0)
    expect(usage.outputTokens).toBe(0)
    expect(usage.estimatedContextTokens).toBe(0)
  })

  it('keeps two different conversations usage separate', async () => {
    history.pushState({}, '', '/c/conv-a')
    handle = startConversationSync(root, STABLE_MS)
    addMessage(root, 'user', 'Hello from conversation A', 'msg-a-1')
    await settle()

    // ChatGPT swaps the rendered messages when navigating conversations.
    root.innerHTML = ''
    history.pushState({}, '', '/c/conv-b')
    addMessage(root, 'user', 'Hello from conversation B, a fair bit longer than A', 'msg-b-1')
    await settle()

    const usageA = await getConversationUsage('conv-a')
    const usageB = await getConversationUsage('conv-b')

    expect(usageA.inputTokens).toBeGreaterThan(0)
    expect(usageB.inputTokens).toBeGreaterThan(0)
    expect(usageA.inputTokens).not.toBe(usageB.inputTokens)
  })

  it('does not double-count historical messages on refresh', async () => {
    history.pushState({}, '', '/c/conv-refresh')
    handle = startConversationSync(root, STABLE_MS)
    addMessage(root, 'user', 'A message that will still be here after reload', 'stable-msg-1')
    await settle()

    const firstVisit = await getConversationUsage('conv-refresh')
    expect(firstVisit.inputTokens).toBeGreaterThan(0)

    // Simulate a page refresh: fresh DOM, fresh tracker instance, same
    // conversation URL, same backend-assigned message id.
    handle.disconnect()
    root.remove()
    root = document.createElement('div')
    document.body.appendChild(root)
    addMessage(root, 'user', 'A message that will still be here after reload', 'stable-msg-1')

    handle = startConversationSync(root, STABLE_MS)
    await settle()

    const afterRefresh = await getConversationUsage('conv-refresh')
    expect(afterRefresh.inputTokens).toBe(firstVisit.inputTokens)
    expect(afterRefresh.countedMessageIds).toEqual(firstVisit.countedMessageIds)
  })

  it('restores previous usage when navigating back to a conversation', async () => {
    history.pushState({}, '', '/c/conv-return')
    handle = startConversationSync(root, STABLE_MS)
    addMessage(root, 'user', 'Original message', 'return-msg-1')
    await settle()
    const original = await getConversationUsage('conv-return')
    expect(original.inputTokens).toBeGreaterThan(0)

    // Navigate away to a different conversation (SPA navigation).
    root.innerHTML = ''
    history.pushState({}, '', '/c/conv-other')
    addMessage(root, 'user', 'Somewhere else entirely', 'other-msg-1')
    await settle()

    // Navigate back; ChatGPT re-renders the original conversation's history.
    root.innerHTML = ''
    history.pushState({}, '', '/c/conv-return')
    addMessage(root, 'user', 'Original message', 'return-msg-1')
    await settle()

    const restored = await getConversationUsage('conv-return')
    expect(restored.inputTokens).toBe(original.inputTokens)
    expect(restored.countedMessageIds).toEqual(original.countedMessageIds)
  })

  it('switches the active conversation on SPA navigation without a reload', async () => {
    history.pushState({}, '', '/c/conv-x')
    handle = startConversationSync(root, STABLE_MS)
    await settle()
    expect((await getActiveConversation()).conversationId).toBe('conv-x')

    history.pushState({}, '', '/c/conv-y')
    await settle()
    expect((await getActiveConversation()).conversationId).toBe('conv-y')
  })

  it('has no active conversation on the new-chat landing page', async () => {
    history.pushState({}, '', '/')
    handle = startConversationSync(root, STABLE_MS)
    await settle()
    expect((await getActiveConversation()).conversationId).toBeNull()
  })

  it('feeds newly-counted messages into the pre-existing global aggregate exactly once', async () => {
    history.pushState({}, '', '/c/conv-global')
    handle = startConversationSync(root, STABLE_MS)
    const before = await getUsage()

    addMessage(root, 'user', 'Counts toward the global total too', 'global-msg-1')
    await settle()
    const after = await getUsage()
    expect(after.inputTokens).toBeGreaterThan(before.inputTokens)

    // Refreshing (same id re-appearing) must not add to the global total again.
    handle.disconnect()
    root.remove()
    root = document.createElement('div')
    document.body.appendChild(root)
    addMessage(root, 'user', 'Counts toward the global total too', 'global-msg-1')
    handle = startConversationSync(root, STABLE_MS)
    await settle()

    const afterRefresh = await getUsage()
    expect(afterRefresh.inputTokens).toBe(after.inputTokens)
  })
})

describe('startConversationSync with an invalidated extension context', () => {
  let storage: FakeChromeStorageHandle
  let root: HTMLDivElement
  let handle: ConversationSyncHandle | null
  let warnSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    storage = installFakeChromeStorage()
    root = document.createElement('div')
    document.body.appendChild(root)
    handle = null
    history.pushState({}, '', '/')
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    handle?.disconnect()
    root.remove()
    storage.uninstall()
    vi.useRealTimers()
    warnSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('logs a single warning (not console.error) when the extension context is invalidated', async () => {
    history.pushState({}, '', '/c/conv-reload')
    handle = startConversationSync(root, STABLE_MS)
    await settle()

    // Simulate the extension being reloaded while this tab stays open: the
    // content script keeps running, but every further chrome.* call fails.
    storage.invalidateExtensionContext()

    addMessage(root, 'user', 'Message sent after the extension reloaded', 'after-reload-1')
    await settle()

    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0][0]).toContain('Extension context invalidated')
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('does not keep retrying or re-warning for further messages once invalidated', async () => {
    history.pushState({}, '', '/c/conv-reload-2')
    handle = startConversationSync(root, STABLE_MS)
    await settle()

    storage.invalidateExtensionContext()

    addMessage(root, 'user', 'First message after reload', 'after-reload-a')
    await settle()
    addMessage(root, 'assistant', 'Second message after reload', 'after-reload-b')
    await settle()

    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('stops observing DOM mutations once invalidation is handled (observer disconnected)', async () => {
    history.pushState({}, '', '/c/conv-reload-3')
    handle = startConversationSync(root, STABLE_MS)
    await settle()

    storage.invalidateExtensionContext()
    addMessage(root, 'user', 'Triggers the first invalidation warning', 'trigger-1')
    await settle()
    expect(warnSpy).toHaveBeenCalledTimes(1)

    // Storage is "healthy" again from the fake's point of view, but the
    // tracker should have already disconnected — no further messages
    // should be recorded, and no new warnings/errors should appear.
    warnSpy.mockClear()
    addMessage(root, 'user', 'Should not be observed at all', 'trigger-2')
    await settle()

    expect(warnSpy).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('does not attempt further chrome.storage calls on SPA navigation after invalidation', async () => {
    history.pushState({}, '', '/c/conv-reload-4')
    handle = startConversationSync(root, STABLE_MS)
    await settle()

    storage.invalidateExtensionContext()

    // SPA navigation (e.g. clicking into another conversation) is a plain
    // DOM/history event and keeps happening regardless of the extension's
    // lifecycle.
    history.pushState({}, '', '/c/conv-reload-5')
    await settle()

    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('still reports a genuine storage error normally (not swallowed as invalidation)', async () => {
    history.pushState({}, '', '/c/conv-generic-error')
    handle = startConversationSync(root, STABLE_MS)
    await settle()

    storage.failStorageWith(new Error('QuotaExceededError'))

    addMessage(root, 'user', 'Triggers a genuine storage failure', 'generic-error-1')
    await settle()

    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy.mock.calls[0][0]).toContain('failed to record input tokens')
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('tags every log line with this instance\'s id, so a stale instance can be told apart from a fresh one', async () => {
    // Regression: "Extension context invalidated" errors look identical
    // whether they come from the current script or one left over from
    // before an extension reload. Tagging every line with an id generated
    // when the instance attaches (and logging that id up front) lets a
    // human confirm from the console alone whether a later error belongs
    // to the instance that just loaded or to some older, stale one.
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

    history.pushState({}, '', '/c/conv-instance-id')
    handle = startConversationSync(root, STABLE_MS)
    await settle()

    expect(infoSpy).toHaveBeenCalledTimes(1)
    const startupLine = infoSpy.mock.calls[0][0] as string
    expect(startupLine).toContain(handle.instanceId)
    expect(startupLine).toContain('content script attached')

    storage.invalidateExtensionContext()
    addMessage(root, 'user', 'Triggers the invalidation warning', 'trigger-instance-id')
    await settle()

    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0][0]).toContain(handle.instanceId)

    infoSpy.mockRestore()
  })

  it('gives two independently-attached instances different ids', () => {
    history.pushState({}, '', '/c/conv-instance-a')
    const handleA = startConversationSync(root, STABLE_MS)

    const rootB = document.createElement('div')
    document.body.appendChild(rootB)
    const handleB = startConversationSync(rootB, STABLE_MS)

    expect(handleA.instanceId).not.toBe(handleB.instanceId)

    handleA.disconnect()
    handleB.disconnect()
    rootB.remove()
  })
})

describe('startConversationSync with messages that have no native message id', () => {
  // Regression for a reported logged-out -> logged-in transition: input 21 /
  // output 338 / total 359 recorded before login, then a new message and a
  // long reply after logging in never moved those numbers at all. ChatGPT
  // does not always expose data-message-id (observed while logged out), so
  // these messages fall back to a role+position+text-derived id. Before the
  // fix, the fallback used position alone, so if an earlier same-role
  // message stopped being present in the DOM at scan time (e.g. a
  // login-triggered re-render of the message list), a later, genuinely new
  // message could land at that same position and compute the *same*
  // fallback id as the one already in the durable "counted" record — and
  // get silently skipped as a duplicate.
  let storage: FakeChromeStorageHandle
  let root: HTMLDivElement
  let handle: ConversationSyncHandle | null

  beforeEach(() => {
    vi.useFakeTimers()
    storage = installFakeChromeStorage()
    root = document.createElement('div')
    document.body.appendChild(root)
    handle = null
    history.pushState({}, '', '/')
  })

  afterEach(() => {
    handle?.disconnect()
    root.remove()
    storage.uninstall()
    vi.useRealTimers()
  })

  it('still counts a new message that lands at the same position as an earlier, now-removed one', async () => {
    history.pushState({}, '', '/c/conv-no-ids')
    handle = startConversationSync(root, STABLE_MS)

    const firstUserMessage = addMessageWithoutId(root, 'user', 'First message before login')
    await settle()
    const afterFirst = await getConversationUsage('conv-no-ids')
    expect(afterFirst.inputTokens).toBeGreaterThan(0)

    // Simulate the DOM composition changing (e.g. a re-render around the
    // login transition) such that the earlier message is no longer present
    // when the new one is scanned — both would sit at role/index user:0.
    firstUserMessage.remove()
    addMessageWithoutId(root, 'user', 'A new message sent after logging in, different text')
    await settle()

    const afterSecond = await getConversationUsage('conv-no-ids')
    expect(afterSecond.inputTokens).toBeGreaterThan(afterFirst.inputTokens)
  })

  it('still counts a long assistant reply after login at the same position as an earlier removed reply', async () => {
    history.pushState({}, '', '/c/conv-no-ids-2')
    handle = startConversationSync(root, STABLE_MS)

    const firstReply = addMessageWithoutId(root, 'assistant', 'Short reply before login')
    await settle()
    const afterFirst = await getConversationUsage('conv-no-ids-2')
    expect(afterFirst.outputTokens).toBeGreaterThan(0)

    firstReply.remove()
    const longReply = 'This is a much longer reply sent after logging in. '.repeat(40)
    addMessageWithoutId(root, 'assistant', longReply)
    await settle()

    const afterSecond = await getConversationUsage('conv-no-ids-2')
    expect(afterSecond.outputTokens).toBeGreaterThan(afterFirst.outputTokens)
  })
})
