/**
 * When the extension is reloaded, updated, or disabled while one of its
 * content scripts is already injected into an open page, Chrome severs
 * that script's binding to the extension's APIs. The page itself is
 * untouched — it doesn't navigate or reload — so the content script's JS
 * (its MutationObserver callbacks, pending timers, event listeners) keeps
 * running, but any further `chrome.*` call now throws or rejects with
 * "Extension context invalidated". Chrome never re-injects a fresh copy
 * into that already-open page; only reloading the page itself does.
 */

/**
 * `chrome.runtime.id` reads as a string while the context is live and
 * becomes `undefined` the instant it's invalidated, with no exception —
 * this lets callers check *before* attempting a doomed `chrome.*` call
 * instead of only reacting to the failure afterwards.
 */
export function isExtensionContextValid(): boolean {
  try {
    return typeof chrome !== 'undefined' && typeof chrome.runtime?.id === 'string'
  } catch {
    return false
  }
}

const INVALIDATED_MESSAGE = 'Extension context invalidated'

/**
 * Matches the specific failure Chrome produces once the extension context
 * has been invalidated, as opposed to a genuine storage/runtime failure.
 * Handles both a proper `Error` (the documented shape) and, defensively, a
 * rejection value that isn't one — some browsers/versions have been known
 * to reject `chrome.*` promises with plain strings or bare objects rather
 * than an `Error` instance, and treating that as a "genuine" error would
 * silently defeat the whole point of this check.
 */
export function isExtensionContextInvalidatedError(error: unknown): boolean {
  if (error instanceof Error) return error.message.includes(INVALIDATED_MESSAGE)
  if (typeof error === 'string') return error.includes(INVALIDATED_MESSAGE)
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message: unknown }).message
    return typeof message === 'string' && message.includes(INVALIDATED_MESSAGE)
  }
  return false
}
