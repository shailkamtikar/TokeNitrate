// ChatGPT-specific DOM knowledge lives only in this file. If ChatGPT changes
// its markup, this is the only place that should need to change.
export const CHATGPT_SELECTORS = {
  userMessage: '[data-message-author-role="user"]',
  assistantMessage: '[data-message-author-role="assistant"]',
} as const

/** Extracts the plain text ChatGPT rendered for a message element. */
export function extractMessageText(element: Element): string {
  return (element.textContent ?? '').trim()
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

/**
 * Returns a stable identifier for a message element, used to avoid
 * re-counting a message across page refreshes (DOM nodes, and any
 * in-memory "already counted" marker on them, don't survive a reload).
 *
 * ChatGPT renders each message with a `data-message-id` attribute sourced
 * from its own backend, which is stable across reloads, so it's preferred
 * when present.
 *
 * If it's ever absent (observed for messages sent while logged out), a
 * deterministic fallback is built from the message's role, its position
 * among same-role messages currently in the DOM, and a hash of its own
 * text. The text component matters: position alone broke down whenever the
 * DOM's composition changed between scans — e.g. an earlier message
 * temporarily leaving the DOM (a re-render, virtualization, or a
 * logged-out-to-logged-in transition reflowing the message list) shifts a
 * later, genuinely new message into an earlier one's position. With a
 * purely positional id, that new message would compute the same fallback
 * id as the old one already in the durable "counted" record and get
 * silently skipped as a duplicate — undercounting real usage. Anchoring
 * the id to the message's own text closes that: a different message at
 * the same position now gets a different id. Two genuinely identical
 * messages at the same role and position are still indistinguishable
 * without a real id — an inherent limit of not having one.
 */
export function extractMessageId(element: Element, fallbackIndex: number): string {
  const nativeId = element.getAttribute('data-message-id')
  if (nativeId) return nativeId
  const role = element.getAttribute('data-message-author-role') ?? 'unknown'
  const text = extractMessageText(element)
  return `fallback:${role}:${fallbackIndex}:${hashText(text)}`
}
