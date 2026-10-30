import { countTokens } from '../../tokenizer'
import { clearStreamUsage, setStreamUsage } from '../../usage/streamStore'
import { getConversationIdFromUrl } from './conversationId'
import { isExtensionContextValid } from './extensionContext'
import { CHATGPT_SELECTORS, extractMessageText } from './selectors'

const PROCESSED_ATTR = 'data-tokenitrate-counted'
const THROTTLE_MS = 250

export interface StreamWatcher {
  disconnect: () => void
}

/**
 * Publishes a provisional token count while ChatGPT is writing a reply.
 *
 * A reply is treated as "streaming" only if its text has been seen growing
 * across observations. A reply that is simply rendered all at once (history
 * loading on page open) is seen only once at full length, so it never
 * triggers this. Once the normal tracker has counted the finished reply
 * (it marks the element), the provisional record is cleared.
 */
export function createStreamWatcher(root: Document | Element): StreamWatcher {
  const lastLength = new WeakMap<Element, number>()
  const growing = new WeakSet<Element>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let publishing = false
  let lastPublished = -1

  function lastAssistant(): Element | null {
    const all = root.querySelectorAll(CHATGPT_SELECTORS.assistantMessage)
    return all.length > 0 ? all[all.length - 1] : null
  }

  function publish(tokens: number): void {
    if (!isExtensionContextValid() || tokens === lastPublished) return
    lastPublished = tokens
    const conversationId = getConversationIdFromUrl(location.href)
    const write =
      tokens > 0
        ? setStreamUsage({ conversationId, tokens, updatedAt: Date.now() })
        : clearStreamUsage()
    void write.catch(() => undefined)
  }

  function evaluate(): void {
    timer = undefined
    if (publishing) return
    publishing = true
    try {
      const element = lastAssistant()
      if (!element) return publish(0)

      const counted = element.hasAttribute(PROCESSED_ATTR)
      const text = extractMessageText(element)
      const previous = lastLength.get(element)
      lastLength.set(element, text.length)
      if (previous !== undefined && text.length > previous) growing.add(element)

      if (counted || !growing.has(element) || !text) return publish(0)
      publish(countTokens(text))
    } finally {
      publishing = false
    }
  }

  const observer = new MutationObserver(() => {
    if (timer === undefined) timer = setTimeout(evaluate, THROTTLE_MS)
  })
  observer.observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
    // Also wake when the normal tracker marks a reply as counted, to clear the provisional count.
    attributes: true,
    attributeFilter: [PROCESSED_ATTR],
  })
  // Prime lengths for anything already on the page, so history never looks like growth.
  evaluate()

  return {
    disconnect() {
      observer.disconnect()
      if (timer !== undefined) clearTimeout(timer)
      if (isExtensionContextValid()) void clearStreamUsage().catch(() => undefined)
    },
  }
}
