import { resolveUsageBudget, type BudgetSource } from '../usage/budgetCalibration'
import { calculateContextUsagePercentage } from '../usage/contextPercentage'
import type { ConversationUsage } from '../usage/conversationModel'
import { getUsageLimitState, type UsageLevel } from '../usage/limitState'
import { limitHitInWindow, type LimitHit } from '../usage/limitHit'
import { nextFreeUpAt, tokensInWindow, type LedgerEntry } from '../usage/tokenLedger'
import { getContextWarning, type ContextWarningLevel } from '../usage/warningState'
import type { Settings } from '../settings/settingsStore'
import type { Tone } from '../components/ui/Ring'

export interface ViewModelInput {
  conversation: ConversationUsage
  draftTokens: number
  settings: Settings
  ledger: LedgerEntry[]
  observations: number[]
  limitHit: LimitHit | null
  now: number
}

export interface ContextView {
  tokens: number
  capacity: number
  percent: number
  remainingPercent: number
  level: ContextWarningLevel
  tone: Tone
  message: string | null
  you: number
  files: number
  chatgpt: number
  draft: number
}

export interface UsageView {
  used: number
  budget: number
  percent: number
  level: UsageLevel
  tone: Tone
  message: string | null
  you: number
  files: number
  chatgpt: number
  freesUpAt: number | null
  budgetSource: BudgetSource
  samples: number
  windowHours: number
}

export function toneFor(level: ContextWarningLevel): Tone {
  if (level === 'critical' || level === 'capacityReached') return 'danger'
  if (level === 'high') return 'warn'
  return 'ok'
}

/** Turns raw stored data into everything the popup shows. Pure, so it is unit-tested. */
export function buildViewModel(input: ViewModelInput): { context: ContextView; usage: UsageView } {
  const { conversation, settings, now } = input

  const contextPercent = calculateContextUsagePercentage(
    conversation.estimatedContextTokens,
    settings.contextCapacityTokens,
  )
  const contextWarning = getContextWarning(contextPercent.roundedPercent)
  const files = conversation.attachmentTokens ?? 0

  const windowMs = settings.usageWindowHours * 3_600_000
  const budget = resolveUsageBudget(settings.usageBudgetTokens, input.observations)
  const windowUsage = tokensInWindow(input.ledger, windowMs, now)
  const limitHitRecently = limitHitInWindow(input.limitHit, windowMs, now)
  const usageState = getUsageLimitState(windowUsage.total, budget.tokens, limitHitRecently)

  return {
    context: {
      tokens: conversation.estimatedContextTokens,
      capacity: settings.contextCapacityTokens,
      percent: contextPercent.roundedPercent,
      remainingPercent: contextPercent.remainingPercent,
      level: contextWarning.level,
      tone: toneFor(contextWarning.level),
      message: contextWarning.message,
      you: Math.max(0, conversation.inputTokens - files),
      files,
      chatgpt: conversation.outputTokens,
      draft: input.draftTokens,
    },
    usage: {
      used: windowUsage.total,
      budget: budget.tokens,
      percent: usageState.percent,
      level: usageState.level,
      tone: toneFor(usageState.level),
      message: usageState.message,
      you: windowUsage.you,
      files: windowUsage.files,
      chatgpt: windowUsage.chatgpt,
      freesUpAt: nextFreeUpAt(input.ledger, windowMs, now),
      budgetSource: budget.source,
      samples: budget.samples,
      windowHours: settings.usageWindowHours,
    },
  }
}
