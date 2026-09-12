/**
 * A TokeNitrate "session" is a ChatGPT conversation, identified by the
 * conversation id ChatGPT puts in the page URL:
 *
 *   https://chatgpt.com/c/<id>
 *   https://chatgpt.com/g/g-<gptId>/c/<id>   (conversation with a custom GPT)
 *   https://chat.openai.com/c/<id>           (legacy domain)
 *
 * A URL with no "/c/<id>" segment (e.g. the new-chat landing page) has no
 * conversation yet, and getConversationIdFromUrl returns null.
 *
 * This is deliberately the only place that parses ChatGPT's URL structure,
 * so it's the only thing that needs to change if that structure changes.
 */
const CONVERSATION_ID_PATTERN = /\/c\/([\w-]+)/

export function getConversationIdFromUrl(url: string): string | null {
  try {
    const { pathname } = new URL(url)
    const match = CONVERSATION_ID_PATTERN.exec(pathname)
    return match ? match[1] : null
  } catch {
    return null
  }
}
