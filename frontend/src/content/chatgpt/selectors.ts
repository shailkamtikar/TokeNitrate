// ChatGPT-specific DOM knowledge lives only in this file. If ChatGPT changes
// its markup, this is the only place that should need to change.
//
// ChatGPT currently ships more than one layout, so every selector is a list
// that covers the older `data-message-author-role` markup as well as the
// newer one observed on the live site (see docs/dom-notes.md). Class names
// are hashed/atomic and are never used.
export const CHATGPT_SELECTORS = {
  userMessage: '[data-message-author-role="user"], [data-user-message-bubble="true"]',
  assistantMessage:
    '[data-message-author-role="assistant"], [data-markdown-text-style="assistant-message"]',
  /** Tried in order; the first match wins. */
  composer: [
    '#prompt-textarea',
    '[contenteditable="true"][role="textbox"]',
    'textarea[name="prompt"]',
    'textarea#mobile-composer-prompt',
  ],
  fileInput: 'input[type="file"]',
} as const

/** Attributes that carry a stable message id, in order of preference. */
const MESSAGE_ID_SOURCES: Array<{ selector: string; attribute: string }> = [
  { selector: '[data-message-id]', attribute: 'data-message-id' },
  { selector: '[data-chatgpt-selection-message-id]', attribute: 'data-chatgpt-selection-message-id' },
  { selector: '[data-chatgpt-search-message-ids]', attribute: 'data-chatgpt-search-message-ids' },
]

/** Extracts the plain text ChatGPT rendered for a message element. */
export function extractMessageText(element: Element): string {
  return (element.textContent ?? '').trim()
}

/** Which side of the conversation this message element belongs to. */
export function getMessageRole(element: Element): 'user' | 'assistant' | 'unknown' {
  const role = element.getAttribute('data-message-author-role')
  if (role === 'user' || role === 'assistant') return role
  if (element.matches(CHATGPT_SELECTORS.userMessage)) return 'user'
  if (element.matches(CHATGPT_SELECTORS.assistantMessage)) return 'assistant'
  return 'unknown'
}

/** Small, fast, deterministic string hash (djb2) — not cryptographic, just
 * enough entropy to distinguish message text for fallback identity. */
function hashText(text: string): string {
  let hash = 5381
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 33) ^ text.charCodeAt(i)
  }
  return (hash >>> 0).toString(36)
}

function nativeIdFor(element: Element): string | null {
  for (const { selector, attribute } of MESSAGE_ID_SOURCES) {
    const holder = element.closest(selector)
    const value = holder?.getAttribute(attribute)
    // `data-chatgpt-search-message-ids` may hold several space-separated ids.
    const first = value?.split(/\s+/)[0]
    if (first) return first
  }
  return null
}

/**
 * Returns a stable identifier for a message element, used to avoid
 * re-counting a message across page refreshes (DOM nodes, and any
 * in-memory "already counted" marker on them, don't survive a reload).
 *
 * ChatGPT puts its own backend message id on the message or on an ancestor
 * (the attribute depends on the layout), and that id is stable across
 * reloads, so it's preferred when present.
 *
 * If it's ever absent (observed for messages sent while logged out), a
 * deterministic fallback is built from the message's role, its position
 * among same-role messages currently in the DOM, and a hash of its own
 * text. The text component matters: position alone broke down whenever the
 * DOM's composition changed between scans — an earlier message temporarily
 * leaving the DOM shifts a later, genuinely new message into an earlier
 * one's position, and with a purely positional id it would be silently
 * skipped as a duplicate. Two genuinely identical messages at the same
 * role and position are still indistinguishable without a real id.
 */
export function extractMessageId(element: Element, fallbackIndex: number): string {
  const nativeId = nativeIdFor(element)
  if (nativeId) return nativeId
  const role = getMessageRole(element)
  const text = extractMessageText(element)
  return `fallback:${role}:${fallbackIndex}:${hashText(text)}`
}

/** Finds the chat composer using the ordered selector list. */
export function findComposer(root: Document | Element = document): HTMLElement | null {
  for (const selector of CHATGPT_SELECTORS.composer) {
    const found = root.querySelector<HTMLElement>(selector)
    if (found) return found
  }
  return null
}
