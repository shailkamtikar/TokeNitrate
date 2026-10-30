import { useCallback, useRef, useState } from 'react'
import { describeCompressError } from '../api/compress'
import {
  MSG_APPLY_DRAFT,
  MSG_COMPRESS,
  MSG_COUNT,
  MSG_GET_DRAFT,
  type ApplyDraftResponse,
  type CompressResponse,
  type CountResponse,
  type GetDraftResponse,
} from '../messaging/protocol'

export type CompressState =
  | { status: 'idle' }
  | { status: 'working' }
  | { status: 'error'; message: string }
  | {
      status: 'result'
      original: string
      compressed: string
      tokensBefore: number
      tokensAfter: number
      unchanged: boolean
      /** null = not yet applied. */
      applied: 'inserted' | 'copied' | 'failed' | 'undone' | null
    }

async function activeTabId(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab?.id ?? null
}

export function useCompress() {
  const [state, setState] = useState<CompressState>({ status: 'idle' })
  const busy = useRef(false)

  const compress = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    setState({ status: 'working' })
    try {
      const tabId = await activeTabId()
      if (tabId === null) throw new Error('no tab')

      let draft: GetDraftResponse
      try {
        draft = await chrome.tabs.sendMessage(tabId, { type: MSG_GET_DRAFT })
      } catch {
        setState({ status: 'error', message: 'Refresh the ChatGPT tab once, then try again.' })
        return
      }
      if (!draft.text.trim()) {
        setState({ status: 'error', message: describeCompressError('empty') })
        return
      }

      const result: CompressResponse = await chrome.runtime.sendMessage({ type: MSG_COMPRESS, text: draft.text })
      if (!result.ok) {
        setState({ status: 'error', message: describeCompressError(result.code) })
        return
      }

      let tokensAfter = draft.tokens
      if (!result.unchanged) {
        const counted: CountResponse = await chrome.tabs.sendMessage(tabId, {
          type: MSG_COUNT,
          text: result.compressed,
        })
        tokensAfter = counted.ok ? counted.tokens : draft.tokens
      }
      setState({
        status: 'result',
        original: draft.text,
        compressed: result.compressed,
        tokensBefore: draft.tokens,
        tokensAfter,
        unchanged: result.unchanged,
        applied: null,
      })
    } catch {
      setState({ status: 'error', message: describeCompressError('upstream_error') })
    } finally {
      busy.current = false
    }
  }, [])

  /** Writes `text` into ChatGPT's composer; falls back to the clipboard if that fails. */
  const write = useCallback(async (text: string): Promise<'inserted' | 'copied' | 'failed'> => {
    try {
      const tabId = await activeTabId()
      if (tabId !== null) {
        const response: ApplyDraftResponse = await chrome.tabs.sendMessage(tabId, { type: MSG_APPLY_DRAFT, text })
        if (response.ok) return 'inserted'
      }
    } catch {
      // fall through to the clipboard
    }
    try {
      await navigator.clipboard.writeText(text)
      return 'copied'
    } catch {
      return 'failed'
    }
  }, [])

  const apply = useCallback(async () => {
    if (state.status !== 'result') return
    const outcome = await write(state.compressed)
    setState({ ...state, applied: outcome })
  }, [state, write])

  const undo = useCallback(async () => {
    if (state.status !== 'result') return
    await write(state.original)
    setState({ ...state, applied: 'undone' })
  }, [state, write])

  const reset = useCallback(() => setState({ status: 'idle' }), [])

  return { state, compress, apply, undo, reset }
}
