import { recordLimitHit } from '../../usage/budgetCalibration'
import { setLimitHit } from '../../usage/limitHit'
import { getLedger, tokensInWindow } from '../../usage/tokenLedger'
import { getSettings } from '../../settings/settingsStore'
import { createAttachmentTracker } from './attachments/attachmentTracker'
import { startConversationSync } from './conversationSync'
import { startDraftController } from './draft/draftController'
import { isExtensionContextValid } from './extensionContext'
import { createLimitWatcher } from './limitWatcher'
import { handlePopupMessage } from './messageHandlers'

// One attachment tracker is shared: the draft badge shows pending files, and
// the conversation sync counts them when the message carrying them is sent.
let draft: ReturnType<typeof startDraftController> | null = null
const attachments = createAttachmentTracker(document, () => draft?.refresh())

draft = startDraftController(document.body, () => attachments.pendingTokens())
startConversationSync(document.body, undefined, attachments)

// When ChatGPT itself says a limit was reached, remember how many tokens we
// had counted in the window: that is a real observation of the budget.
createLimitWatcher(document.body, () => {
  if (!isExtensionContextValid()) return
  void (async () => {
    const settings = await getSettings()
    const used = tokensInWindow(await getLedger(), settings.usageWindowHours * 3_600_000).total
    await setLimitHit({ at: Date.now(), usedTokens: used })
    await recordLimitHit(used)
  })().catch(() => undefined)
})

// Answers the popup: is this tab tracked, what is the draft, apply a shortened
// draft. A tab that was open before the extension was installed or reloaded
// has no script until it is refreshed once, which the popup explains.
if (isExtensionContextValid()) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    handlePopupMessage(message, sendResponse)
  })
}
