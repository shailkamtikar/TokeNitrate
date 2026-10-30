import { findComposer } from '../selectors'
import { readComposerText } from './composer'

function normalize(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\s+$/g, '')
}

function writeTextarea(box: HTMLTextAreaElement | HTMLInputElement, text: string): void {
  // React-controlled inputs ignore a plain `.value =`; the native setter plus
  // an input event is what makes the framework notice the change.
  const proto = box instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(box, text)
  box.dispatchEvent(new Event('input', { bubbles: true }))
}

function writeContentEditable(box: HTMLElement, text: string): boolean {
  if (typeof document.execCommand !== 'function') return false
  box.focus()
  // Select everything inside the composer so the insert replaces it.
  const selection = window.getSelection()
  const range = document.createRange()
  range.selectNodeContents(box)
  selection?.removeAllRanges()
  selection?.addRange(range)

  const lines = text.split('\n')
  document.execCommand('delete')
  lines.forEach((line, index) => {
    if (index > 0) document.execCommand('insertParagraph')
    if (line) document.execCommand('insertText', false, line)
  })
  return true
}

/**
 * Replaces the draft in ChatGPT's composer with `text` and confirms the
 * change by reading it back. Returns false when the composer is missing or
 * the write did not take, so the caller can fall back to the clipboard. It
 * never submits the message.
 */
export function writeComposerText(text: string, root: Document | Element = document): boolean {
  const box = findComposer(root)
  if (!box) return false

  if (box instanceof HTMLTextAreaElement || box instanceof HTMLInputElement) {
    writeTextarea(box, text)
  } else if (!writeContentEditable(box, text)) {
    return false
  }
  return normalize(readComposerText(box)) === normalize(text)
}
