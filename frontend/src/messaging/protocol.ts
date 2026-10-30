// Message types exchanged between the popup, the background worker and the
// ChatGPT content script. Kept in one file so both sides agree on the shapes.

export const MSG_PING = 'tokenitrate:ping'
export const MSG_GET_DRAFT = 'tokenitrate:get-draft'
export const MSG_APPLY_DRAFT = 'tokenitrate:apply-draft'
export const MSG_COUNT = 'tokenitrate:count'
export const MSG_COMPRESS = 'tokenitrate:compress'

/** popup -> content script: read the current draft text. */
export interface GetDraftMessage {
  type: typeof MSG_GET_DRAFT
}
export interface GetDraftResponse {
  ok: boolean
  text: string
  tokens: number
}

/** popup -> content script: count tokens (keeps the large tokenizer out of the popup bundle). */
export interface CountMessage {
  type: typeof MSG_COUNT
  text: string
}
export interface CountResponse {
  ok: boolean
  tokens: number
}

/** popup -> content script: replace the draft with `text`. */
export interface ApplyDraftMessage {
  type: typeof MSG_APPLY_DRAFT
  text: string
}
export interface ApplyDraftResponse {
  ok: boolean
}

/** popup -> background: shorten `text` through the backend. */
export interface CompressMessage {
  type: typeof MSG_COMPRESS
  text: string
}

export type CompressErrorCode =
  | 'empty'
  | 'too_long'
  | 'rate_limited'
  | 'quota_exhausted'
  | 'timeout'
  | 'unreachable'
  | 'not_configured'
  | 'upstream_error'
  | 'invalid_response'

export type CompressResponse =
  | { ok: true; compressed: string; originalChars: number; compressedChars: number; unchanged: boolean }
  | { ok: false; code: CompressErrorCode }
