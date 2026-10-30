import { createAttachmentTracker } from './attachments/attachmentTracker'
import { startConversationSync } from './conversationSync'
import { startDraftController } from './draft/draftController'

// One attachment tracker is shared: the draft badge shows pending files, and
// the conversation sync counts them when the message carrying them is sent.
let draft: ReturnType<typeof startDraftController> | null = null
const attachments = createAttachmentTracker(document, () => draft?.refresh())

draft = startDraftController(document.body, () => attachments.pendingTokens())
startConversationSync(document.body, undefined, attachments)
