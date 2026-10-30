import { getContextCapacityTokens } from '../../../config/contextCapacity'
import { getConversationUsage } from '../../../usage/conversationUsageStore'
import { clearDraftUsage, setDraftUsage } from '../../../usage/draftStore'
import { getConversationIdFromUrl } from '../conversationId'
import { isExtensionContextValid } from '../extensionContext'
import { onLocationChange } from '../navigationWatcher'
import { createDraftBadge, type BadgeValue } from './draftBadge'
import { createDraftWatcher, type DraftSnapshot } from './draftWatcher'

export interface DraftController {
  /** Re-evaluate the draft (e.g. after pending attachments changed). */
  refresh: () => void
  disconnect: () => void
}

/** Estimated tokens of attachments waiting to be sent. Supplied by the attachment tracker. */
export type PendingFileTokens = () => number

type Severity = BadgeValue['severity']

function severityFor(contextTokens: number, added: number): Severity {
  const capacity = getContextCapacityTokens()
  const projected = contextTokens + added
  if (projected >= capacity) return 'danger'
  if (projected >= capacity * 0.75) return 'warn'
  return 'normal'
}

/**
 * Connects the draft watcher to the on-page badge and to the popup: it
 * shows the live count next to the composer, colours it by how close the
 * chat would get to its estimated context limit if sent, and publishes the
 * number (only) for the popup.
 */
export function startDraftController(
  root: Document | Element,
  pendingFileTokens: PendingFileTokens = () => 0,
): DraftController {
  const badge = createDraftBadge()
  let latest: DraftSnapshot = { tokens: 0, approximate: false, composer: null }
  let renderId = 0

  async function render(): Promise<void> {
    const thisRender = ++renderId
    const fileTokens = pendingFileTokens()
    const conversationId = getConversationIdFromUrl(location.href)
    let contextTokens = 0
    if (conversationId && isExtensionContextValid()) {
      try {
        contextTokens = (await getConversationUsage(conversationId)).estimatedContextTokens
      } catch {
        contextTokens = 0
      }
    }
    if (thisRender !== renderId) return

    badge.update(
      {
        tokens: latest.tokens,
        fileTokens,
        approximate: latest.approximate,
        severity: severityFor(contextTokens, latest.tokens + fileTokens),
      },
      latest.composer,
    )

    if (!isExtensionContextValid()) return
    try {
      if (latest.tokens + fileTokens <= 0) await clearDraftUsage()
      else
        await setDraftUsage({
          conversationId,
          tokens: latest.tokens,
          fileTokens,
          updatedAt: Date.now(),
        })
    } catch {
      // The extension was reloaded under this tab; tracking will pause itself.
    }
  }

  const watcher = createDraftWatcher(root, (snapshot) => {
    latest = snapshot
    void render()
  })

  // A conversation switch invalidates the draft shown for the old one.
  const unsubscribeNavigation = onLocationChange(() => {
    watcher.refresh()
  })

  return {
    refresh() {
      void render()
    },
    disconnect() {
      watcher.disconnect()
      unsubscribeNavigation()
      badge.destroy()
      renderId++
      if (isExtensionContextValid()) void clearDraftUsage().catch(() => undefined)
    },
  }
}
