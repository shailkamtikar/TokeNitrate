// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { freshDraftFor, DRAFT_STALE_MS } from '../../../usage/draftStore'
import { readComposerText } from './composer'
import { estimateDraftTokens } from './estimateDraft'
import { createDraftWatcher } from './draftWatcher'

function proseMirror(lines: string[]): HTMLDivElement {
  const el = document.createElement('div')
  el.setAttribute('contenteditable', 'true')
  el.setAttribute('role', 'textbox')
  for (const line of lines) {
    const p = document.createElement('p')
    p.textContent = line
    el.appendChild(p)
  }
  return el
}

function emptyProseMirror(): HTMLDivElement {
  const el = document.createElement('div')
  el.setAttribute('contenteditable', 'true')
  el.setAttribute('role', 'textbox')
  el.innerHTML = '<p data-empty-paragraph="true" class="placeholder" data-placeholder="Ask ChatGPT"><br></p>'
  return el
}

describe('readComposerText', () => {
  it('reads a single line', () => {
    expect(readComposerText(proseMirror(['hello']))).toBe('hello')
  })
  it('joins paragraphs with newlines', () => {
    expect(readComposerText(proseMirror(['a', 'b', 'c']))).toBe('a\nb\nc')
  })
  it('ignores the placeholder when empty', () => {
    expect(readComposerText(emptyProseMirror())).toBe('')
  })
  it('reads text typed into a paragraph that still carries the placeholder class', () => {
    const el = emptyProseMirror()
    el.querySelector('p')!.textContent = 'typed'
    expect(readComposerText(el)).toBe('typed')
  })
  it('returns empty for a missing composer without throwing', () => {
    expect(readComposerText(null)).toBe('')
  })
  it('reads a textarea composer', () => {
    const ta = document.createElement('textarea')
    ta.value = 'typed here'
    expect(readComposerText(ta)).toBe('typed here')
  })
  it('keeps unicode and emoji', () => {
    expect(readComposerText(proseMirror(['こんにちは 😀']))).toBe('こんにちは 😀')
  })
})

describe('estimateDraftTokens', () => {
  it('is zero for empty text', () => {
    expect(estimateDraftTokens('')).toEqual({ tokens: 0, approximate: false })
  })
  it('counts normal text exactly', () => {
    const r = estimateDraftTokens('Hello, world!')
    expect(r.tokens).toBeGreaterThan(0)
    expect(r.approximate).toBe(false)
  })
  it('approximates a very large paste instead of tokenizing it', () => {
    const r = estimateDraftTokens('a'.repeat(200_000))
    expect(r.approximate).toBe(true)
    expect(r.tokens).toBe(50_000)
  })
})

describe('createDraftWatcher', () => {
  let root: HTMLDivElement

  beforeEach(() => {
    vi.useFakeTimers()
    root = document.createElement('div')
    document.body.appendChild(root)
  })
  afterEach(() => {
    root.remove()
    vi.useRealTimers()
  })

  it('reports a count after typing, debounced', () => {
    const composer = proseMirror(['hi'])
    root.appendChild(composer)
    const seen: number[] = []
    const watcher = createDraftWatcher(root, (s) => seen.push(s.tokens), 100)
    seen.length = 0

    for (let i = 0; i < 20; i++) {
      composer.querySelector('p')!.textContent = `hello world ${i}`
      composer.dispatchEvent(new Event('input'))
    }
    vi.advanceTimersByTime(99)
    expect(seen).toHaveLength(0)
    vi.advanceTimersByTime(5)
    expect(seen).toHaveLength(1)
    expect(seen[0]).toBeGreaterThan(0)
    watcher.disconnect()
  })

  it('reports zero when the draft is cleared', () => {
    const composer = proseMirror(['some words'])
    root.appendChild(composer)
    const seen: number[] = []
    const watcher = createDraftWatcher(root, (s) => seen.push(s.tokens), 50)
    composer.querySelector('p')!.textContent = ''
    composer.dispatchEvent(new Event('input'))
    vi.advanceTimersByTime(60)
    expect(seen[seen.length - 1]).toBe(0)
    watcher.disconnect()
  })

  it('re-attaches when the composer element is replaced', async () => {
    const first = proseMirror(['one'])
    root.appendChild(first)
    const seen: number[] = []
    const watcher = createDraftWatcher(root, (s) => seen.push(s.tokens), 50)
    first.remove()
    const second = proseMirror(['a considerably longer replacement draft'])
    root.appendChild(second)
    await Promise.resolve()
    vi.advanceTimersByTime(300)
    second.dispatchEvent(new Event('input'))
    vi.advanceTimersByTime(60)
    expect(seen[seen.length - 1]).toBeGreaterThan(2)
    watcher.disconnect()
  })

  it('does not throw when there is no composer', () => {
    const watcher = createDraftWatcher(root, () => undefined, 50)
    vi.advanceTimersByTime(500)
    watcher.disconnect()
  })
})

describe('freshDraftFor', () => {
  const draft = { conversationId: 'c1', tokens: 5, fileTokens: 0, updatedAt: 1000 }
  it('returns the draft for the same chat', () => {
    expect(freshDraftFor(draft, 'c1', 1500)).toEqual(draft)
  })
  it('ignores a draft from another chat', () => {
    expect(freshDraftFor(draft, 'c2', 1500).tokens).toBe(0)
  })
  it('ignores a stale draft', () => {
    expect(freshDraftFor(draft, 'c1', 1000 + DRAFT_STALE_MS + 1).tokens).toBe(0)
  })
  it('handles a missing draft', () => {
    expect(freshDraftFor(undefined, 'c1').tokens).toBe(0)
  })
})
