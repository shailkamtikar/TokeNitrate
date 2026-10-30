// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeChromeStorage, type FakeChromeStorageHandle } from '../../../testUtils/fakeChromeStorage'
import { getConversationUsage } from '../../../usage/conversationUsageStore'
import { getUsage } from '../../../usage/usageStore'
import { startConversationSync, type ConversationSyncHandle } from '../conversationSync'
import { attachmentShownIn, createAttachmentTracker, type AttachmentTracker } from './attachmentTracker'

function pick(file: File): void {
  const input = document.createElement('input')
  input.type = 'file'
  Object.defineProperty(input, 'files', { value: [file] })
  document.body.appendChild(input)
  input.dispatchEvent(new Event('change', { bubbles: true }))
  input.remove()
}

function makeFile(name: string, size: number, type = 'text/plain'): File {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('attachment tracker', () => {
  let tracker: AttachmentTracker
  let clock = 1_000

  beforeEach(() => {
    clock = 1_000
    tracker = createAttachmentTracker(document, undefined, () => clock)
  })
  afterEach(() => tracker.disconnect())

  it('captures a picked file and estimates its tokens', () => {
    pick(makeFile('notes.txt', 4000))
    expect(tracker.pending()).toHaveLength(1)
    expect(tracker.pendingTokens()).toBe(1000)
  })

  it('captures several files', () => {
    pick(makeFile('a.txt', 400))
    pick(makeFile('b.txt', 800))
    expect(tracker.pending()).toHaveLength(2)
  })

  it('does not add the same file twice', () => {
    const file = makeFile('same.txt', 400)
    pick(file)
    pick(file)
    expect(tracker.pending()).toHaveLength(1)
  })

  it('captures dropped files', () => {
    const event = new Event('drop', { bubbles: true }) as DragEvent
    Object.defineProperty(event, 'dataTransfer', { value: { files: [makeFile('dropped.txt', 400)] } })
    document.dispatchEvent(event)
    expect(tracker.pending()).toHaveLength(1)
  })

  it('captures pasted files', () => {
    const event = new Event('paste', { bubbles: true }) as ClipboardEvent
    Object.defineProperty(event, 'clipboardData', { value: { files: [makeFile('shot.png', 100, 'image/png')] } })
    document.dispatchEvent(event)
    expect(tracker.pending()[0].estimatedTokens).toBe(255)
  })

  it('drops stale pending files', () => {
    pick(makeFile('old.txt', 400))
    clock += 31 * 60 * 1000
    expect(tracker.pending()).toHaveLength(0)
  })

  it('never stores file contents', () => {
    pick(makeFile('secret.txt', 400))
    expect(Object.keys(tracker.pending()[0]).sort()).toEqual(
      ['addedAt', 'estimatedTokens', 'id', 'name', 'size', 'type'],
    )
  })

  it('matches a file by name in the sent turn and clears everything pending', () => {
    pick(makeFile('report.pdf', 4000, 'application/pdf'))
    pick(makeFile('removed.txt', 4000))
    const turn = document.createElement('div')
    turn.innerHTML = '<div data-user-message-bubble="true">see attached</div><span>report.pdf</span>'
    document.body.appendChild(turn)
    const matched = tracker.consumeForMessage(turn.firstElementChild!)
    turn.remove()
    expect(matched.map((m) => m.name)).toEqual(['report.pdf'])
    expect(tracker.pending()).toHaveLength(0)
  })

  it('matches an image by a thumbnail when no name is shown', () => {
    pick(makeFile('photo.png', 50_000, 'image/png'))
    const turn = document.createElement('div')
    turn.setAttribute('data-turn-key', 't1')
    turn.innerHTML = '<img src="x.png"><div data-user-message-bubble="true">look</div>'
    document.body.appendChild(turn)
    const matched = tracker.consumeForMessage(turn.querySelector('[data-user-message-bubble]')!)
    turn.remove()
    expect(matched).toHaveLength(1)
  })

  it('attachmentShownIn is false when nothing in the turn references the file', () => {
    const turn = document.createElement('div')
    turn.textContent = 'just text'
    const item = { id: '1', name: 'x.pdf', type: 'application/pdf', size: 1, estimatedTokens: 1, addedAt: 0 }
    expect(attachmentShownIn(item, turn)).toBe(false)
  })
})

describe('attachments counted on send', () => {
  const STABLE_MS = 50
  let storage: FakeChromeStorageHandle
  let root: HTMLDivElement
  let handle: ConversationSyncHandle | null
  let tracker: AttachmentTracker

  async function settle(): Promise<void> {
    await Promise.resolve()
    vi.advanceTimersByTime(STABLE_MS)
    for (let i = 0; i < 12; i++) await Promise.resolve()
  }

  function sendUserMessage(id: string, text: string, extra = ''): void {
    const turn = document.createElement('div')
    turn.setAttribute('data-turn-key', id)
    turn.innerHTML = `<div data-user-message-bubble="true" data-message-id="${id}">${text}</div>${extra}`
    root.appendChild(turn)
  }

  beforeEach(() => {
    vi.useFakeTimers()
    storage = installFakeChromeStorage()
    root = document.createElement('div')
    document.body.appendChild(root)
    history.pushState({}, '', '/c/conv-files')
    tracker = createAttachmentTracker(document)
    handle = startConversationSync(root, STABLE_MS, tracker)
  })
  afterEach(() => {
    handle?.disconnect()
    tracker.disconnect()
    root.remove()
    storage.uninstall()
    vi.useRealTimers()
  })

  it('adds attachment tokens to input once, when the message is sent', async () => {
    pick(makeFile('data.txt', 4000))
    // Picking alone must not count anything yet.
    await settle()
    expect((await getConversationUsage('conv-files')).inputTokens).toBe(0)

    // An older message is already in the chat, so this one is a live send.
    sendUserMessage('m1', 'first')
    await settle()
    const base = (await getConversationUsage('conv-files')).inputTokens

    pick(makeFile('data2.txt', 4000))
    sendUserMessage('m2', 'second', '<span>data2.txt</span>')
    await settle()

    const usage = await getConversationUsage('conv-files')
    expect(usage.attachmentTokens).toBe(1000)
    expect(usage.inputTokens).toBeGreaterThanOrEqual(base + 1000)
    expect(usage.estimatedContextTokens).toBe(usage.totalTokens)
    expect((await getUsage()).inputTokens).toBe(usage.inputTokens)
  })

  it('does not count a file that was removed before sending', async () => {
    sendUserMessage('m1', 'first')
    await settle()

    pick(makeFile('removed.txt', 4000))
    sendUserMessage('m2', 'second')
    await settle()

    expect((await getConversationUsage('conv-files')).attachmentTokens).toBe(0)
  })

  it('does not count the same sent message twice after a reload', async () => {
    sendUserMessage('m1', 'first')
    await settle()
    pick(makeFile('data.txt', 4000))
    sendUserMessage('m2', 'second', '<span>data.txt</span>')
    await settle()
    const first = await getConversationUsage('conv-files')

    handle?.disconnect()
    root.innerHTML = ''
    sendUserMessage('m1', 'first')
    sendUserMessage('m2', 'second', '<span>data.txt</span>')
    handle = startConversationSync(root, STABLE_MS, tracker)
    await settle()

    const after = await getConversationUsage('conv-files')
    expect(after.attachmentTokens).toBe(first.attachmentTokens)
    expect(after.inputTokens).toBe(first.inputTokens)
  })
})
