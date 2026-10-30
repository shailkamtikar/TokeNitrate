import {
  MSG_APPLY_DRAFT,
  MSG_COUNT,
  MSG_GET_DRAFT,
  MSG_PING,
  type ApplyDraftResponse,
  type CountResponse,
  type GetDraftResponse,
} from '../../messaging/protocol'
import { countTokens } from '../../tokenizer'
import { getConversationIdFromUrl } from './conversationId'
import { readComposerText } from './draft/composer'
import { writeComposerText } from './draft/composerWriter'
import { findComposer } from './selectors'

type Responder = (response: unknown) => void

/**
 * Handles requests from the popup. Registered once by the content script;
 * lets the popup learn whether this tab is tracked, read the draft for the
 * prompt optimizer, and write a shortened draft back.
 */
export function handlePopupMessage(message: unknown, sendResponse: Responder): void {
  const type = (message as { type?: unknown } | null)?.type
  switch (type) {
    case MSG_PING:
      sendResponse({ ok: true, conversationId: getConversationIdFromUrl(location.href) })
      return
    case MSG_GET_DRAFT: {
      const text = readComposerText(findComposer())
      const response: GetDraftResponse = { ok: true, text, tokens: countTokens(text) }
      sendResponse(response)
      return
    }
    case MSG_COUNT: {
      const text = (message as { text?: unknown }).text
      const response: CountResponse =
        typeof text === 'string' ? { ok: true, tokens: countTokens(text) } : { ok: false, tokens: 0 }
      sendResponse(response)
      return
    }
    case MSG_APPLY_DRAFT: {
      const text = (message as { text?: unknown }).text
      const response: ApplyDraftResponse = {
        ok: typeof text === 'string' && writeComposerText(text),
      }
      sendResponse(response)
      return
    }
    default:
  }
}
