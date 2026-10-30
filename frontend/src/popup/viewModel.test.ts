import { describe, expect, it } from 'vitest'
import { EMPTY_CONVERSATION_USAGE } from '../usage/conversationModel'
import { DEFAULT_SETTINGS } from '../settings/settingsStore'
import { buildViewModel, type ViewModelInput } from './viewModel'

const NOW = 1_000_000_000_000
const HOUR = 3_600_000

function input(overrides: Partial<ViewModelInput> = {}): ViewModelInput {
  return {
    conversation: EMPTY_CONVERSATION_USAGE,
    draftTokens: 0,
    settings: DEFAULT_SETTINGS,
    ledger: [],
    observations: [],
    limitHit: null,
    now: NOW,
    ...overrides,
  }
}

describe('buildViewModel', () => {
  it('is all zero and calm for an empty state', () => {
    const { context, usage } = buildViewModel(input())
    expect(context.percent).toBe(0)
    expect(context.tone).toBe('ok')
    expect(usage.used).toBe(0)
    expect(usage.freesUpAt).toBeNull()
    expect(usage.budgetSource).toBe('default')
  })

  it('computes the context percentage against the configured capacity', () => {
    const { context } = buildViewModel(
      input({ conversation: { ...EMPTY_CONVERSATION_USAGE, estimatedContextTokens: 8000, totalTokens: 8000 } }),
    )
    expect(context.percent).toBe(50)
    expect(context.capacity).toBe(16_000)
  })

  it('splits input into typed text and files, and sums to the parts', () => {
    const { context } = buildViewModel(
      input({
        conversation: {
          ...EMPTY_CONVERSATION_USAGE,
          inputTokens: 1300,
          attachmentTokens: 300,
          outputTokens: 700,
          totalTokens: 2000,
          estimatedContextTokens: 2000,
        },
      }),
    )
    expect(context.you).toBe(1000)
    expect(context.files).toBe(300)
    expect(context.chatgpt).toBe(700)
    expect(context.you + context.files + context.chatgpt).toBe(context.tokens)
  })

  it('handles records stored before attachmentTokens existed', () => {
    const legacy = { ...EMPTY_CONVERSATION_USAGE, inputTokens: 50 }
    delete (legacy as { attachmentTokens?: number }).attachmentTokens
    expect(buildViewModel(input({ conversation: legacy })).context.files).toBe(0)
  })

  it('turns danger once the chat is over capacity', () => {
    const { context } = buildViewModel(
      input({ conversation: { ...EMPTY_CONVERSATION_USAGE, estimatedContextTokens: 20_000 } }),
    )
    expect(context.tone).toBe('danger')
    expect(context.remainingPercent).toBe(0)
  })

  it('sums window usage across chats and reports when it frees up', () => {
    const { usage } = buildViewModel(
      input({
        ledger: [
          { t: NOW - 4 * HOUR, kind: 'you', tokens: 1000 },
          { t: NOW - HOUR, kind: 'chatgpt', tokens: 2000 },
          { t: NOW - 9 * HOUR, kind: 'you', tokens: 5000 },
        ],
      }),
    )
    expect(usage.used).toBe(3000)
    expect(usage.percent).toBe(10)
    expect(usage.freesUpAt).toBe(NOW - 4 * HOUR + 5 * HOUR)
  })

  it('uses a learned budget when observations exist', () => {
    const { usage } = buildViewModel(input({ observations: [20_000] }))
    expect(usage.budget).toBe(20_000)
    expect(usage.budgetSource).toBe('learned')
  })

  it('shows the usage limit as reached when ChatGPT reported one', () => {
    const { usage } = buildViewModel(input({ limitHit: { at: NOW - HOUR, usedTokens: 100 } }))
    expect(usage.percent).toBe(100)
    expect(usage.tone).toBe('danger')
  })
})
