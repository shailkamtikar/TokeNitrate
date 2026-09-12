// @vitest-environment jsdom
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

import { act, createElement, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeChromeStorage, type FakeChromeStorageHandle } from '../testUtils/fakeChromeStorage'
import { startConversationSync, type ConversationSyncHandle } from '../content/chatgpt/conversationSync'
import { calculateContextUsagePercentage } from '../usage/contextPercentage'
import {
  getActiveConversation,
  setActiveConversation,
  updateConversationUsage,
} from '../usage/conversationUsageStore'
import { addInputTokens, addOutputTokens, getUsage } from '../usage/usageStore'
import { useConversationUsage, type ConversationContext } from './useConversationUsage'

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

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(resolve))
}

async function settle(): Promise<void> {
  await flushMicrotasks()
  vi.advanceTimersByTime(STABLE_MS)
  for (let i = 0; i < 10; i++) {
    await flushMicrotasks()
  }
}

interface RenderedHook {
  getValue: () => ConversationContext | undefined
  flush: () => Promise<void>
  unmount: () => void
}

function renderUseConversationUsage(): RenderedHook {
  const captured: { value?: ConversationContext } = {}
  function TestComponent() {
    const value = useConversationUsage()
    // Captured in an effect, not during render, so re-renders here don't
    // trip "no side effects during render" lint rules.
    useEffect(() => {
      captured.value = value
    })
    return null
  }
  const container = document.createElement('div')
  document.body.appendChild(container)
  let root: Root
  act(() => {
    root = createRoot(container)
    root.render(createElement(TestComponent))
  })
  return {
    getValue: () => captured.value,
    flush: async () => {
      await act(async () => {
        await settle()
      })
    },
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

describe('useConversationUsage', () => {
  let storage: FakeChromeStorageHandle
  let chatRoot: HTMLDivElement
  let sync: ConversationSyncHandle | null
  let hook: RenderedHook | null

  beforeEach(() => {
    vi.useFakeTimers()
    storage = installFakeChromeStorage()
    chatRoot = document.createElement('div')
    document.body.appendChild(chatRoot)
    sync = null
    hook = null
    history.pushState({}, '', '/')
  })

  afterEach(() => {
    hook?.unmount()
    sync?.disconnect()
    chatRoot.remove()
    storage.uninstall()
    vi.useRealTimers()
  })

  it('1. survives a page refresh: the conversation keeps its stored usage', async () => {
    history.pushState({}, '', '/c/conv-refresh')
    sync = startConversationSync(chatRoot, STABLE_MS)
    addMessage(chatRoot, 'user', 'Explain photosynthesis', 'msg-1')
    addMessage(chatRoot, 'assistant', 'Photosynthesis is '.repeat(200), 'msg-2')
    await settle()

    // Simulate a refresh: tear down and recreate the content script's DOM
    // and sync instance, sharing only persisted storage — nothing carries
    // over in memory.
    sync.disconnect()
    chatRoot.remove()
    chatRoot = document.createElement('div')
    document.body.appendChild(chatRoot)
    addMessage(chatRoot, 'user', 'Explain photosynthesis', 'msg-1')
    addMessage(chatRoot, 'assistant', 'Photosynthesis is '.repeat(200), 'msg-2')
    sync = startConversationSync(chatRoot, STABLE_MS)
    await settle()

    hook = renderUseConversationUsage()
    await hook.flush()

    expect(hook.getValue()?.conversationId).toBe('conv-refresh')
    expect(hook.getValue()?.usage.estimatedContextTokens).toBeGreaterThan(0)
  })

  it('2. the active conversation pointer resolves to the refreshed conversation', async () => {
    history.pushState({}, '', '/c/conv-pointer')
    sync = startConversationSync(chatRoot, STABLE_MS)
    addMessage(chatRoot, 'user', 'Hello', 'msg-1')
    await settle()

    sync.disconnect()
    chatRoot.remove()
    chatRoot = document.createElement('div')
    document.body.appendChild(chatRoot)
    addMessage(chatRoot, 'user', 'Hello', 'msg-1')
    sync = startConversationSync(chatRoot, STABLE_MS)
    await settle()

    const pointer = await getActiveConversation()
    expect(pointer.conversationId).toBe('conv-pointer')
  })

  it('3. returns the conversation-specific usage, not the global aggregate', async () => {
    // Global usage from unrelated activity, larger than this conversation.
    await addInputTokens(50_000)
    await addOutputTokens(50_000)

    await updateConversationUsage('conv-specific', (current) => ({
      ...current,
      inputTokens: 100,
      outputTokens: 200,
      totalTokens: 300,
      estimatedContextTokens: 300,
    }))
    await setActiveConversation('conv-specific')

    hook = renderUseConversationUsage()
    await hook.flush()

    expect(hook.getValue()?.usage.estimatedContextTokens).toBe(300)
  })

  it('4. session percentage is non-zero when the conversation has tokens', async () => {
    await updateConversationUsage('conv-nonzero', (current) => ({
      ...current,
      estimatedContextTokens: 12_800, // 10% of the 128K reference capacity
    }))
    await setActiveConversation('conv-nonzero')

    hook = renderUseConversationUsage()
    await hook.flush()

    const usage = hook.getValue()?.usage
    expect(usage?.estimatedContextTokens).toBe(12_800)
    const { roundedPercent } = calculateContextUsagePercentage(usage!.estimatedContextTokens)
    expect(roundedPercent).toBeGreaterThan(0)
  })

  it('5. a larger global total does not affect the current conversation percentage', async () => {
    await addInputTokens(200_000)
    await addOutputTokens(200_000) // global total: 400K, well over capacity

    await updateConversationUsage('conv-independent', (current) => ({
      ...current,
      estimatedContextTokens: 6_400, // 5% of capacity
    }))
    await setActiveConversation('conv-independent')

    hook = renderUseConversationUsage()
    await hook.flush()

    const usage = hook.getValue()?.usage
    expect(usage?.estimatedContextTokens).toBe(6_400)
    const { roundedPercent } = calculateContextUsagePercentage(usage!.estimatedContextTokens)
    expect(roundedPercent).toBe(5)
  })

  it('does not let a slow, stale read for a previous conversation overwrite a newer one', async () => {
    // Regression for a reported bug: after switching the active
    // conversation (e.g. across a refresh sequence), a getConversationUsage
    // read that was already in flight for the *previous* conversation could
    // resolve after the new one's read and clobber the display back to
    // stale (or empty) data.
    await updateConversationUsage('conv-race-a', (current) => ({
      ...current,
      estimatedContextTokens: 1_000,
    }))
    await updateConversationUsage('conv-race-b', (current) => ({
      ...current,
      estimatedContextTokens: 2_000,
    }))

    const realGet = chrome.storage.local.get.bind(chrome.storage.local) as (
      keys?: string,
    ) => Promise<unknown>
    const delayedGet = (keys?: string): Promise<unknown> => {
      if (typeof keys === 'string' && keys.includes('conv-race-a')) {
        return new Promise((resolve) => {
          setTimeout(() => resolve(realGet(keys)), 500)
        })
      }
      return realGet(keys)
    }
    chrome.storage.local.get = delayedGet as unknown as typeof chrome.storage.local.get

    hook = renderUseConversationUsage()

    await act(async () => {
      await setActiveConversation('conv-race-a')
      await flushMicrotasks()
      await setActiveConversation('conv-race-b')
      vi.advanceTimersByTime(1000)
      await flushMicrotasks()
      await flushMicrotasks()
      await flushMicrotasks()
    })

    expect(hook.getValue()?.conversationId).toBe('conv-race-b')
    expect(hook.getValue()?.usage.estimatedContextTokens).toBe(2_000)
  })

  it('mirrors the reported three-conversation scenario: global sums all of them, session tracks only the active one', async () => {
    // Story: ~8.6K, Photosynthesis: ~700, Monsoon: ~4.3K — tracked via the
    // real content-script pipeline so the global aggregate accumulates the
    // same way it does in production (only for genuinely new messages).
    history.pushState({}, '', '/c/conv-story')
    sync = startConversationSync(chatRoot, STABLE_MS)
    addMessage(chatRoot, 'user', 'Tell me a story', 'story-1')
    addMessage(chatRoot, 'assistant', 'Once upon a time. '.repeat(430), 'story-2') // ~8.6K
    await settle()

    chatRoot.innerHTML = ''
    history.pushState({}, '', '/c/conv-photosynthesis')
    addMessage(chatRoot, 'user', 'Explain photosynthesis briefly', 'photo-1')
    addMessage(chatRoot, 'assistant', 'Photosynthesis converts light to energy. '.repeat(20), 'photo-2') // ~700
    await settle()

    chatRoot.innerHTML = ''
    history.pushState({}, '', '/c/conv-monsoon')
    addMessage(chatRoot, 'user', 'What causes monsoons', 'monsoon-1')
    addMessage(chatRoot, 'assistant', 'Monsoons are seasonal wind patterns. '.repeat(215), 'monsoon-2') // ~4.3K
    await settle()

    const global = await getUsage()
    const story = await (await import('../usage/conversationUsageStore')).getConversationUsage('conv-story')
    const photosynthesis = await (
      await import('../usage/conversationUsageStore')
    ).getConversationUsage('conv-photosynthesis')
    const monsoon = await (await import('../usage/conversationUsageStore')).getConversationUsage(
      'conv-monsoon',
    )

    // Global is the sum across all three conversations — this is the
    // intended, cumulative "all-time observed tokens" behavior.
    expect(global.totalTokens).toBe(
      story.totalTokens + photosynthesis.totalTokens + monsoon.totalTokens,
    )
    expect(global.totalTokens).toBeGreaterThan(story.totalTokens)
    expect(global.totalTokens).toBeGreaterThan(monsoon.totalTokens)

    // Monsoon is the currently active conversation (last one navigated to).
    hook = renderUseConversationUsage()
    await hook.flush()

    expect(hook.getValue()?.conversationId).toBe('conv-monsoon')
    expect(hook.getValue()?.usage.estimatedContextTokens).toBe(monsoon.estimatedContextTokens)
    // The session percentage must come from monsoon's own tokens, not the
    // (larger) global total.
    expect(hook.getValue()?.usage.estimatedContextTokens).not.toBe(global.totalTokens)

    const monsoonPercent = calculateContextUsagePercentage(
      hook.getValue()!.usage.estimatedContextTokens,
    )
    const globalPercentIfMisused = calculateContextUsagePercentage(global.totalTokens)
    expect(monsoonPercent.roundedPercent).not.toBe(globalPercentIfMisused.roundedPercent)

    // Switching back to the story conversation must update the session
    // percentage to story's own value, not stay stuck on monsoon's.
    await act(async () => {
      chatRoot.innerHTML = ''
      history.pushState({}, '', '/c/conv-story')
      addMessage(chatRoot, 'user', 'Tell me a story', 'story-1')
      addMessage(chatRoot, 'assistant', 'Once upon a time. '.repeat(430), 'story-2')
      await settle()
    })

    expect(hook.getValue()?.conversationId).toBe('conv-story')
    expect(hook.getValue()?.usage.estimatedContextTokens).toBe(story.estimatedContextTokens)
  })
})
