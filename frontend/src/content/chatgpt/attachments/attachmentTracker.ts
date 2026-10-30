import { estimateAttachmentTokens, classifyAttachment } from '../../../attachments/estimate'
import { ATTACHMENT_ESTIMATION } from '../../../config/modelProfile'

export interface PendingAttachment {
  id: string
  name: string
  type: string
  size: number
  estimatedTokens: number
  addedAt: number
}

export interface AttachmentTracker {
  /** Estimated tokens of all attachments waiting to be sent. */
  pendingTokens: () => number
  pending: () => PendingAttachment[]
  /**
   * Called when a live user message appears. Returns the pending files that
   * are visible in that message (matched by file name, or by an image being
   * present for image files) and clears every pending file: anything not
   * shown in the sent message was removed before sending and must not count.
   */
  consumeForMessage: (messageElement: Element) => PendingAttachment[]
  disconnect: () => void
}

function fileId(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`
}

/**
 * Finds the element holding a whole conversation turn so attachment chips,
 * which sit beside (not inside) the text bubble, are included in the match.
 */
function turnRootFor(messageElement: Element): Element {
  return (
    messageElement.closest('[data-turn-key]') ??
    messageElement.closest('[data-chatgpt-search-unit-key]') ??
    messageElement.parentElement ??
    messageElement
  )
}

/** True if `attachment` appears to be shown in `turn` (pure, exported for tests). */
export function attachmentShownIn(attachment: PendingAttachment, turn: Element): boolean {
  const text = turn.textContent ?? ''
  if (text.toLowerCase().includes(attachment.name.toLowerCase())) return true
  const kind = classifyAttachment(attachment)
  // Images are usually rendered as thumbnails with no visible file name.
  if (kind === 'image' && turn.querySelector('img, [style*="background-image"]')) return true
  return false
}

/**
 * Records the name, type and size (never the contents) of files the user
 * adds to the composer — via the file picker, drag-and-drop, or paste — and
 * attributes them to the next message that is actually sent. Listeners are
 * passive observers on the capture phase and never alter ChatGPT's behavior.
 */
export function createAttachmentTracker(
  doc: Document,
  onChange: () => void = () => undefined,
  now: () => number = Date.now,
): AttachmentTracker {
  const pending = new Map<string, PendingAttachment>()

  function prune(): void {
    const cutoff = now() - ATTACHMENT_ESTIMATION.pendingMaxAgeMs
    for (const [id, item] of pending) if (item.addedAt < cutoff) pending.delete(id)
  }

  function add(files: FileList | File[] | null | undefined): void {
    if (!files || files.length === 0) return
    let changed = false
    for (const file of Array.from(files)) {
      const id = fileId(file)
      if (pending.has(id)) continue
      pending.set(id, {
        id,
        name: file.name,
        type: file.type,
        size: file.size,
        estimatedTokens: estimateAttachmentTokens(file),
        addedAt: now(),
      })
      changed = true
    }
    if (changed) onChange()
  }

  function onFileInput(event: Event): void {
    const target = event.target
    if (target instanceof HTMLInputElement && target.type === 'file') add(target.files)
  }
  function onDrop(event: DragEvent): void {
    add(event.dataTransfer?.files)
  }
  function onPaste(event: ClipboardEvent): void {
    add(event.clipboardData?.files)
  }

  doc.addEventListener('change', onFileInput, true)
  doc.addEventListener('drop', onDrop, true)
  doc.addEventListener('paste', onPaste, true)

  return {
    pendingTokens() {
      prune()
      let total = 0
      for (const item of pending.values()) total += item.estimatedTokens
      return total
    },
    pending() {
      prune()
      return Array.from(pending.values())
    },
    consumeForMessage(messageElement) {
      prune()
      if (pending.size === 0) return []
      const turn = turnRootFor(messageElement)
      const matched = Array.from(pending.values()).filter((item) => attachmentShownIn(item, turn))
      pending.clear()
      onChange()
      return matched
    },
    disconnect() {
      doc.removeEventListener('change', onFileInput, true)
      doc.removeEventListener('drop', onDrop, true)
      doc.removeEventListener('paste', onPaste, true)
      pending.clear()
    },
  }
}
