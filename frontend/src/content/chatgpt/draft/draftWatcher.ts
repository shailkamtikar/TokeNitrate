import { DRAFT_DEBOUNCE_MS } from '../../../config/modelProfile'
import { findComposer } from '../selectors'
import { estimateDraftTokens } from './estimateDraft'
import { readComposerText } from './composer'

/** ChatGPT mutates the page constantly while streaming; coalesce composer lookups. */
const ROOT_CHECK_MS = 200

export interface DraftSnapshot {
  tokens: number
  approximate: boolean
  composer: HTMLElement | null
}

export interface DraftWatcher {
  disconnect: () => void
  /** Re-evaluates immediately (used when pending attachments change). */
  refresh: () => void
}

/**
 * Follows the composer as the user types and reports an estimated token
 * count for the draft, debounced so tokenizing never runs on every
 * keystroke. ChatGPT re-creates the composer when navigating between chats,
 * so the watcher also keeps looking for the current composer element and
 * re-attaches when it changes. The draft text itself is never stored or
 * sent anywhere: only the number leaves this function.
 */
export function createDraftWatcher(
  root: Document | Element,
  onDraft: (snapshot: DraftSnapshot) => void,
  debounceMs: number = DRAFT_DEBOUNCE_MS,
): DraftWatcher {
  let composer: HTMLElement | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let composerObserver: MutationObserver | null = null
  let lastReported = ''
  let rootCheckPending = false
  let rootCheckTimer: ReturnType<typeof setTimeout> | undefined

  function report(): void {
    const text = readComposerText(composer)
    const { tokens, approximate } = estimateDraftTokens(text)
    const signature = `${tokens}:${approximate}:${composer ? 1 : 0}`
    if (signature === lastReported) return
    lastReported = signature
    onDraft({ tokens, approximate, composer })
  }

  function schedule(): void {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      report()
    }, debounceMs)
  }

  function attach(next: HTMLElement | null): void {
    if (next === composer) return
    composerObserver?.disconnect()
    composerObserver = null
    composer?.removeEventListener('input', schedule)
    composer = next
    if (composer) {
      composer.addEventListener('input', schedule)
      composerObserver = new MutationObserver(schedule)
      composerObserver.observe(composer, { childList: true, subtree: true, characterData: true })
    }
    // Composer swapped (navigation, send): report straight away so the
    // badge doesn't linger on a stale number.
    lastReported = ''
    report()
  }

  const rootObserver = new MutationObserver(() => {
    if (rootCheckPending) return
    rootCheckPending = true
    rootCheckTimer = setTimeout(() => {
      rootCheckPending = false
      attach(findComposer(root))
    }, ROOT_CHECK_MS)
  })
  rootObserver.observe(root, { childList: true, subtree: true })
  attach(findComposer(root))

  return {
    disconnect() {
      if (timer !== undefined) clearTimeout(timer)
      if (rootCheckTimer !== undefined) clearTimeout(rootCheckTimer)
      rootObserver.disconnect()
      composerObserver?.disconnect()
      composer?.removeEventListener('input', schedule)
      composer = null
    },
    refresh() {
      lastReported = ''
      report()
    },
  }
}
