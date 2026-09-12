import { countTokens } from '../../tokenizer'
import type { ConversationUsage } from '../../usage/conversationModel'
import {
  setActiveConversation,
  updateConversationUsage,
} from '../../usage/conversationUsageStore'
import { addInputTokens, addOutputTokens } from '../../usage/usageStore'
import { getConversationIdFromUrl } from './conversationId'
import { isExtensionContextInvalidatedError, isExtensionContextValid } from './extensionContext'
import {
  createMessageTracker,
  DEFAULT_ASSISTANT_STABLE_MS,
  type MessageTracker,
} from './messageTracker'
import { onLocationChange } from './navigationWatcher'

export interface ConversationSyncHandle {
  disconnect: () => void
  /** This attached instance's id — see startConversationSync's doc comment. */
  instanceId: string
}

type TokenField = 'inputTokens' | 'outputTokens'

/**
 * Records one message against a conversation's stored usage, exactly once,
 * using `messageId` as the durable dedupe key. This is what makes reloading
 * a conversation (which re-renders its whole visible history into fresh DOM
 * nodes) safe: `countedMessageIds` persists in storage, so history already
 * accounted for on a previous visit is recognized and skipped here rather
 * than added again.
 */
async function recordMessage(
  conversationId: string,
  field: TokenField,
  messageId: string,
  text: string,
): Promise<void> {
  const tokenCount = countTokens(text)
  let wasNew = false

  await updateConversationUsage(conversationId, (current) => {
    if (current.countedMessageIds.includes(messageId)) {
      return current
    }
    wasNew = true

    const inputTokens = current.inputTokens + (field === 'inputTokens' ? tokenCount : 0)
    const outputTokens = current.outputTokens + (field === 'outputTokens' ? tokenCount : 0)
    const totalTokens = inputTokens + outputTokens

    const next: ConversationUsage = {
      inputTokens,
      outputTokens,
      totalTokens,
      // V1: estimated context ≈ sum of tokenized visible conversation text.
      estimatedContextTokens: totalTokens,
      countedMessageIds: [...current.countedMessageIds, messageId],
      lastUpdated: Date.now(),
    }
    return next
  })

  // The pre-existing all-time aggregate across every conversation. Only
  // updated for messages that were actually new, so it stays consistent
  // with the per-conversation dedupe above instead of double-counting on
  // refresh the way it implicitly could before conversation-level tracking
  // existed.
  if (wasNew) {
    if (field === 'inputTokens') await addInputTokens(tokenCount)
    else await addOutputTokens(tokenCount)
  }
}

/**
 * Keeps stored usage in sync with whichever ChatGPT conversation is loaded
 * in `root`'s document: it identifies the active conversation from the URL,
 * re-attaches message tracking whenever that conversation changes
 * (including ChatGPT's SPA navigation between conversations), and lets
 * `recordMessage`'s durable dedupe handle both live streaming messages and
 * a conversation's already-rendered history on load/refresh.
 *
 * If the extension itself is reloaded/updated while this instance is
 * already running in an open ChatGPT tab, every further `chrome.*` call
 * here will fail with "Extension context invalidated" (see
 * extensionContext.ts) — Chrome doesn't re-inject a fresh content script
 * into a page that's still open. Rather than keep retrying and logging
 * that on every message, the first time it's detected we log one warning
 * and stop tracking entirely (disconnecting the observer and pending
 * timers, and unsubscribing from navigation) until the page is refreshed,
 * which loads a fresh, valid instance.
 */
/** Generates a short id so each attached instance's log lines can be told
 * apart in the console — see the module doc comment for why that matters. */
function generateInstanceId(): string {
  return Math.random().toString(36).slice(2, 8)
}

export function startConversationSync(
  root: Document | Element,
  assistantStableMs: number = DEFAULT_ASSISTANT_STABLE_MS,
): ConversationSyncHandle {
  // Identifies *this* attached instance in every log line it produces. If
  // the extension is reloaded/updated while a tab is still open, that tab
  // keeps running its old content script (a "stale" instance) alongside
  // whatever fresh one loads the next time a ChatGPT tab is opened or
  // refreshed — both can independently log "Extension context invalidated"
  // failures, and from the text alone they're indistinguishable. Comparing
  // the instance id against the one logged by the most recent page
  // load/refresh (see the startup log below) tells them apart conclusively:
  // an error tagged with an id that predates your last refresh is a stale
  // leftover, not a bug in the current script.
  const instanceId = generateInstanceId()
  const logPrefix = `[TokeNitrate:${instanceId}]`

  let activeConversationId: string | null = null
  let activeTracker: MessageTracker | null = null
  let unsubscribeNavigation: (() => void) | null = null
  let stopped = false
  let contextInvalidatedLogged = false

  function stop(): void {
    if (stopped) return
    stopped = true
    unsubscribeNavigation?.()
    unsubscribeNavigation = null
    activeTracker?.disconnect()
    activeTracker = null
  }

  /**
   * The extension was reloaded/updated while this instance was already
   * running (see the module doc comment above). Logged once — not on every
   * message — and then this instance shuts itself down rather than keep
   * attempting doomed chrome.* calls.
   */
  function stopDueToInvalidatedContext(): void {
    if (!contextInvalidatedLogged) {
      contextInvalidatedLogged = true
      console.warn(
        `${logPrefix} Extension context invalidated (the extension was reloaded or updated) — pausing tracking on this page. Refresh the ChatGPT tab to resume.`,
      )
    }
    stop()
  }

  /**
   * Routes a failed chrome.storage call from either recordMessage or
   * setActiveConversation. Anything other than an invalidated-context
   * failure is a genuine storage/runtime error and is still logged in
   * full, every time, exactly as before.
   */
  function handleStorageError(error: unknown, action: string): void {
    if (isExtensionContextInvalidatedError(error)) {
      stopDueToInvalidatedContext()
      return
    }
    console.error(`${logPrefix} failed to ${action}`, error)
  }

  function attach(conversationId: string): void {
    activeTracker = createMessageTracker(
      root,
      {
        onUserMessage: ({ id, text }) => {
          if (stopped) return
          if (!isExtensionContextValid()) {
            stopDueToInvalidatedContext()
            return
          }
          void recordMessage(conversationId, 'inputTokens', id, text).catch((error: unknown) => {
            handleStorageError(error, 'record input tokens')
          })
        },
        onAssistantMessage: ({ id, text }) => {
          if (stopped) return
          if (!isExtensionContextValid()) {
            stopDueToInvalidatedContext()
            return
          }
          void recordMessage(conversationId, 'outputTokens', id, text).catch((error: unknown) => {
            handleStorageError(error, 'record output tokens')
          })
        },
      },
      assistantStableMs,
      // Scopes the tracker's DOM "already processed" marker to this
      // conversation, so if the DOM isn't torn down across a conversation
      // switch (e.g. a login-triggered re-render that keeps old message
      // elements around), those nodes aren't mistaken for already handled
      // under the new conversation — see messageTracker.ts.
      conversationId,
    )
  }

  function handleUrlChange(url: string): void {
    if (stopped) return
    if (!isExtensionContextValid()) {
      stopDueToInvalidatedContext()
      return
    }

    const conversationId = getConversationIdFromUrl(url)
    if (conversationId === activeConversationId) return

    activeTracker?.disconnect()
    activeTracker = null
    activeConversationId = conversationId

    void setActiveConversation(conversationId).catch((error: unknown) => {
      handleStorageError(error, 'set active conversation')
    })

    // A null conversationId means there's no conversation yet (e.g. the
    // new-chat landing page) — nothing to attribute usage to until ChatGPT
    // navigates to a real conversation URL.
    if (conversationId) attach(conversationId)
  }

  console.info(`${logPrefix} content script attached`)

  handleUrlChange(location.href)
  unsubscribeNavigation = onLocationChange(handleUrlChange)

  return {
    disconnect: stop,
    instanceId,
  }
}
