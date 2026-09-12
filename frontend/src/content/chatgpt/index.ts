import { countTokens } from '../../tokenizer'
import { addInputTokens, addOutputTokens } from '../../usage/usageStore'
import { createMessageTracker } from './messageTracker'

createMessageTracker(document.body, {
  onUserMessage: (text) => {
    void addInputTokens(countTokens(text)).catch((error) => {
      console.error('[TokeNitrate] failed to record input tokens', error)
    })
  },
  onAssistantMessage: (text) => {
    void addOutputTokens(countTokens(text)).catch((error) => {
      console.error('[TokeNitrate] failed to record output tokens', error)
    })
  },
})
