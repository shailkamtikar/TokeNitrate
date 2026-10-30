// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { handlePopupMessage } from '../messageHandlers'
import { writeComposerText } from './composerWriter'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('writeComposerText', () => {
  it('replaces the text of a textarea composer and fires an input event', () => {
    document.body.innerHTML = '<textarea name="prompt">old long draft</textarea>'
    const box = document.querySelector('textarea')!
    let fired = 0
    box.addEventListener('input', () => fired++)
    expect(writeComposerText('new short')).toBe(true)
    expect(box.value).toBe('new short')
    expect(fired).toBe(1)
  })

  it('keeps line breaks in a textarea', () => {
    document.body.innerHTML = '<textarea name="prompt"></textarea>'
    expect(writeComposerText('a\nb\nc')).toBe(true)
    expect(document.querySelector('textarea')!.value).toBe('a\nb\nc')
  })

  it('returns false when there is no composer', () => {
    expect(writeComposerText('anything')).toBe(false)
  })

  it('returns false for a rich editor when editing is unsupported, so the caller can use the clipboard', () => {
    document.body.innerHTML = '<div contenteditable="true" role="textbox"><p>old</p></div>'
    // jsdom has no document.execCommand
    expect(writeComposerText('new')).toBe(false)
  })
})

describe('handlePopupMessage', () => {
  it('answers a ping', () => {
    let response: unknown
    history.pushState({}, '', '/c/abc-123')
    handlePopupMessage({ type: 'tokenitrate:ping' }, (r) => (response = r))
    expect(response).toEqual({ ok: true, conversationId: 'abc-123' })
  })

  it('returns the draft text and its token count', () => {
    document.body.innerHTML = '<textarea name="prompt">Hello world, how are you?</textarea>'
    let response: { ok: boolean; text: string; tokens: number } | undefined
    handlePopupMessage({ type: 'tokenitrate:get-draft' }, (r) => (response = r as typeof response))
    expect(response?.text).toBe('Hello world, how are you?')
    expect(response?.tokens).toBeGreaterThan(3)
  })

  it('counts tokens for arbitrary text', () => {
    let response: { ok: boolean; tokens: number } | undefined
    handlePopupMessage({ type: 'tokenitrate:count', text: 'Hello world' }, (r) => (response = r as typeof response))
    expect(response?.ok).toBe(true)
    expect(response?.tokens).toBeGreaterThan(0)
  })

  it('refuses to apply a non-string draft', () => {
    let response: unknown
    handlePopupMessage({ type: 'tokenitrate:apply-draft', text: 42 }, (r) => (response = r))
    expect(response).toEqual({ ok: false })
  })

  it('ignores unknown messages', () => {
    let called = false
    handlePopupMessage({ type: 'something-else' }, () => (called = true))
    expect(called).toBe(false)
  })
})
