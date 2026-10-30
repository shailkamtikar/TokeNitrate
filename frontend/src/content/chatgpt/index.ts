import { startConversationSync } from './conversationSync'
import { startDraftController } from './draft/draftController'

startConversationSync(document.body)
startDraftController(document.body)
