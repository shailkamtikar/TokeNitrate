import { CHATGPT_SELECTORS, extractMessageText } from './selectors'

export interface MessageTrackerCallbacks {
  onUserMessage: (text: string) => void
  onAssistantMessage: (text: string) => void
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

function isProcessed(element: Element): boolean {
  return element.hasAttribute(PROCESSED_ATTR)
}

function markProcessed(element: Element): void {
  element.setAttribute(PROCESSED_ATTR, 'true')
}

/**
 * Watches `root` for ChatGPT user/assistant messages and reports each one
 * exactly once: user messages as soon as they appear, assistant messages
 * once their text has stopped changing for `stableMs`.
 */
export function createMessageTracker(
  root: Document | Element,
  callbacks: MessageTrackerCallbacks,
  stableMs: number = DEFAULT_ASSISTANT_STABLE_MS,
): MessageTracker {
  const pendingAssistant = new Map<Element, ReturnType<typeof setTimeout>>()

  function scanUserMessages(): void {
    const nodes = root.querySelectorAll(CHATGPT_SELECTORS.userMessage)
    for (const element of nodes) {
      if (isProcessed(element)) continue
      const text = extractMessageText(element)
      if (!text) continue
      markProcessed(element)
      callbacks.onUserMessage(text)
    }
  }

  function scheduleAssistantCheck(element: Element): void {
    const existingTimer = pendingAssistant.get(element)
    if (existingTimer !== undefined) clearTimeout(existingTimer)

    const timer = setTimeout(() => {
      pendingAssistant.delete(element)
      if (isProcessed(element) || !element.isConnected) return
      const text = extractMessageText(element)
      if (!text) return
      markProcessed(element)
      callbacks.onAssistantMessage(text)
    }, stableMs)

    pendingAssistant.set(element, timer)
  }

  function scanAssistantMessages(): void {
    const nodes = root.querySelectorAll(CHATGPT_SELECTORS.assistantMessage)
    for (const element of nodes) {
      if (isProcessed(element)) continue
      scheduleAssistantCheck(element)
    }
  }

  function handleMutations(): void {
    scanUserMessages()
    scanAssistantMessages()
  }

  const observer = new MutationObserver(handleMutations)
  observer.observe(root, { childList: true, subtree: true, characterData: true })

  // Pick up anything already on the page when the tracker attaches.
  handleMutations()

  return {
    disconnect() {
      observer.disconnect()
      for (const timer of pendingAssistant.values()) clearTimeout(timer)
      pendingAssistant.clear()
    },
  }
}
