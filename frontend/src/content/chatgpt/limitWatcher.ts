import { CHATGPT_SELECTORS } from './selectors'

/**
 * Phrases ChatGPT uses when it tells a free user they hit a usage limit,
 * e.g. "You've reached the free plan limit for ...". The exact wording and
 * markup have not been observed on the live site yet (it takes hitting the
 * limit), so this is deliberately loose: a short piece of UI text that says
 * reached/hit/exceeded near "limit" or "cap".
 */
const LIMIT_PATTERN = /\b(reached|hit|exceeded)\b[^.\n]{0,60}\b(limit|cap)\b/i
const MAX_TEXT_LENGTH = 400

export function looksLikeLimitMessage(text: string): boolean {
  const trimmed = text.trim()
  return trimmed.length > 0 && trimmed.length <= MAX_TEXT_LENGTH && LIMIT_PATTERN.test(trimmed)
}

function isInsideChatMessage(node: Element): boolean {
  return Boolean(
    node.closest(
      `${CHATGPT_SELECTORS.userMessage}, ${CHATGPT_SELECTORS.assistantMessage}, [data-turn-key], [contenteditable="true"]`,
    ),
  )
}

export interface LimitWatcher {
  disconnect: () => void
}

/**
 * Notices ChatGPT's own "you've reached your limit" notice. Only newly added
 * UI elements outside the conversation turns are inspected, so a message that
 * merely *talks about* limits is never mistaken for the real notice.
 */
export function createLimitWatcher(root: Document | Element, onLimitReached: () => void): LimitWatcher {
  let lastFired = 0
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const added of Array.from(mutation.addedNodes)) {
        if (!(added instanceof Element)) continue
        if (isInsideChatMessage(added)) continue
        if (looksLikeLimitMessage(added.textContent ?? '')) {
          const now = Date.now()
          if (now - lastFired < 60_000) return
          lastFired = now
          onLimitReached()
          return
        }
      }
    }
  })
  observer.observe(root, { childList: true, subtree: true })
  return { disconnect: () => observer.disconnect() }
}
