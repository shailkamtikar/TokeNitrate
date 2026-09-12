import { CHATGPT_SELECTORS, extractMessageId, extractMessageText } from './selectors'

export interface TrackedMessage {
  id: string
  text: string
}

export interface MessageTrackerCallbacks {
  onUserMessage: (message: TrackedMessage) => void
  onAssistantMessage: (message: TrackedMessage) => void
}

export interface MessageTracker {
  disconnect: () => void
}

/**
 * How long an assistant message's text must stay unchanged before it's
 * treated as "done streaming" and counted. ChatGPT streams tokens into the
 * DOM incrementally with no reliable "generation finished" event we can
 * depend on across UI changes, so completion is inferred from the content
 * going quiet rather than from a specific ChatGPT-provided signal.
 */
export const DEFAULT_ASSISTANT_STABLE_MS = 1200

const PROCESSED_ATTR = 'data-tokenitrate-counted'

/**
 * The marker's value is the scope that set it (see `scopeId` below), not a
 * bare "true". If a tracker for conversation B attaches to a DOM that still
 * contains nodes an earlier tracker for conversation A already marked (the
 * DOM isn't guaranteed to be torn down just because the active conversation
 * changed), those nodes must not look "already processed" to B — otherwise
 * they'd never be evaluated against B's own durable counted-message record
 * and could go permanently uncounted. Scoping the marker value means a
 * mismatched scope is treated the same as no marker at all.
 */
function isProcessed(element: Element, scopeId: string): boolean {
  return element.getAttribute(PROCESSED_ATTR) === scopeId
}

function markProcessed(element: Element, scopeId: string): void {
  element.setAttribute(PROCESSED_ATTR, scopeId)
}

/**
 * Watches `root` for ChatGPT user/assistant messages and reports each one
 * exactly once *per page load, per `scopeId`*: user messages as soon as
 * they appear, assistant messages once their text has stopped changing for
 * `stableMs`.
 *
 * `scopeId` should identify whatever this tracker instance is tracking for
 * (conversationSync.ts passes the conversation id) so that re-attaching a
 * tracker for a different scope doesn't inherit another scope's DOM marks.
 * This only guards against re-processing the same DOM node while a tracker
 * for the same scope is alive — it has no memory across page refreshes.
 * Callers that need to persist "already counted" across those (see
 * conversationSync.ts) should key off `message.id` against their own
 * durable store, not rely on this alone.
 */
export function createMessageTracker(
  root: Document | Element,
  callbacks: MessageTrackerCallbacks,
  stableMs: number = DEFAULT_ASSISTANT_STABLE_MS,
  scopeId = 'default',
): MessageTracker {
  const pendingAssistant = new Map<Element, ReturnType<typeof setTimeout>>()

  function scanUserMessages(): void {
    const nodes = root.querySelectorAll(CHATGPT_SELECTORS.userMessage)
    nodes.forEach((element, index) => {
      if (isProcessed(element, scopeId)) return
      const text = extractMessageText(element)
      if (!text) return
      const id = extractMessageId(element, index)
      markProcessed(element, scopeId)
      callbacks.onUserMessage({ id, text })
    })
  }

  function scheduleAssistantCheck(element: Element, index: number): void {
    const existingTimer = pendingAssistant.get(element)
    if (existingTimer !== undefined) clearTimeout(existingTimer)

    const timer = setTimeout(() => {
      pendingAssistant.delete(element)
      if (isProcessed(element, scopeId) || !element.isConnected) return
      const text = extractMessageText(element)
      if (!text) return
      const id = extractMessageId(element, index)
      markProcessed(element, scopeId)
      callbacks.onAssistantMessage({ id, text })
    }, stableMs)

    pendingAssistant.set(element, timer)
  }

  function scanAssistantMessages(): void {
    const nodes = root.querySelectorAll(CHATGPT_SELECTORS.assistantMessage)
    nodes.forEach((element, index) => {
      if (isProcessed(element, scopeId)) return
      scheduleAssistantCheck(element, index)
    })
  }

  function handleMutations(): void {
    scanUserMessages()
    scanAssistantMessages()
  }

  const observer = new MutationObserver(handleMutations)
  observer.observe(root, { childList: true, subtree: true, characterData: true })

  // Pick up anything already on the page when the tracker attaches (e.g. a
  // conversation's history on load, or after switching conversations).
  handleMutations()

  return {
    disconnect() {
      observer.disconnect()
      for (const timer of pendingAssistant.values()) clearTimeout(timer)
      pendingAssistant.clear()
    },
  }
}
