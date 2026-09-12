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
