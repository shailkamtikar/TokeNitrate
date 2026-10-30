/**
 * ChatGPT is a single-page app: moving between conversations (and starting
 * a new one, where the URL becomes /c/<id> after the first message) updates
 * the URL via the History API instead of a page load.
 *
 * A content script runs in an *isolated JavaScript world*. Wrapping
 * history.pushState/replaceState here only intercepts calls made from this
 * script — NOT the calls ChatGPT's own page code makes, which are the ones
 * that matter. So URL changes are detected through several independent
 * routes, all funnelling into one de-duplicated notification:
 *
 *  1. the Navigation API (`navigation` events), where available;
 *  2. `popstate` / `hashchange`;
 *  3. our own pushState/replaceState wrappers (same-world calls);
 *  4. a light poll of `location.href` as the guaranteed fallback.
 *
 * A notification is only sent when the URL actually changed.
 */
type LocationChangeListener = (url: string) => void

const POLL_INTERVAL_MS = 300

const listeners = new Set<LocationChangeListener>()
let patched = false
let lastUrl = ''
let pollTimer: ReturnType<typeof setInterval> | undefined

function notify(): void {
  const url = location.href
  if (url === lastUrl) return
  lastUrl = url
  for (const listener of listeners) listener(url)
}

function patchHistory(): void {
  if (patched) return
  patched = true

  const originalPushState = history.pushState.bind(history)
  const originalReplaceState = history.replaceState.bind(history)

  history.pushState = (...args: Parameters<History['pushState']>) => {
    originalPushState(...args)
    notify()
  }
  history.replaceState = (...args: Parameters<History['replaceState']>) => {
    originalReplaceState(...args)
    notify()
  }
  window.addEventListener('popstate', notify)
  window.addEventListener('hashchange', notify)

  const navigation = (window as { navigation?: EventTarget }).navigation
  navigation?.addEventListener('currententrychange', notify)
  navigation?.addEventListener('navigatesuccess', notify)
}

function startPolling(): void {
  if (pollTimer !== undefined) return
  pollTimer = setInterval(notify, POLL_INTERVAL_MS)
}

function stopPollingIfIdle(): void {
  if (listeners.size > 0 || pollTimer === undefined) return
  clearInterval(pollTimer)
  pollTimer = undefined
}

/** Invokes `listener` with the new URL whenever the page navigates, including SPA navigation. Returns an unsubscribe function. */
export function onLocationChange(listener: LocationChangeListener): () => void {
  patchHistory()
  if (!lastUrl) lastUrl = location.href
  listeners.add(listener)
  startPolling()
  return () => {
    listeners.delete(listener)
    stopPollingIfIdle()
  }
}
