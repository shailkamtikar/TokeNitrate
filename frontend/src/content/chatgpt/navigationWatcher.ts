/**
 * ChatGPT is a single-page app: moving between conversations updates the
 * URL via the History API (pushState/replaceState) rather than a full page
 * load, so `window.onload`/navigation events won't see it. This patches
 * history.pushState/replaceState (once, regardless of how many listeners
 * subscribe) and also listens for popstate, notifying subscribers only when
 * the URL actually changed.
 */
type LocationChangeListener = (url: string) => void

const listeners = new Set<LocationChangeListener>()
let patched = false
let lastUrl = ''

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
}

/** Invokes `listener` with the new URL whenever the page navigates, including SPA navigation. Returns an unsubscribe function. */
export function onLocationChange(listener: LocationChangeListener): () => void {
  patchHistory()
  if (!lastUrl) lastUrl = location.href
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
