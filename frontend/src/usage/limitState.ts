import type { ContextWarningLevel } from './warningState'

export type UsageLevel = ContextWarningLevel

export interface UsageLimitState {
  percent: number
  rawPercent: number
  remainingPercent: number
  level: UsageLevel
  message: string | null
}

const LEVELS: Array<{ min: number; level: UsageLevel; message: string | null }> = [
  {
    min: 100,
    level: 'capacityReached',
    message:
      'Estimated usage budget reached. ChatGPT may slow you down or switch models until older usage ages out.',
  },
  { min: 90, level: 'critical', message: 'Almost at the estimated usage budget for this window.' },
  { min: 75, level: 'high', message: 'Usage is getting high for this window.' },
  { min: 50, level: 'moderate', message: 'Over half of the estimated usage budget is used.' },
  { min: 0, level: 'normal', message: null },
]

/**
 * State of the account-wide usage limit: tokens used in the rolling window
 * against the estimated budget. `limitHitRecently` is true when ChatGPT
 * itself reported a limit inside the current window, which overrides the
 * estimate: the limit is definitely reached whatever our numbers say.
 */
export function getUsageLimitState(
  usedTokens: number,
  budgetTokens: number,
  limitHitRecently = false,
): UsageLimitState {
  const safeBudget = budgetTokens > 0 ? budgetTokens : 1
  const rawPercent = (Math.max(0, usedTokens) / safeBudget) * 100
  const percent = limitHitRecently ? 100 : Math.round(Math.min(100, rawPercent))
  const effective = limitHitRecently ? 100 : rawPercent
  const match = LEVELS.find((l) => effective >= l.min) ?? LEVELS[LEVELS.length - 1]
  return {
    percent,
    rawPercent,
    remainingPercent: Math.max(0, 100 - percent),
    level: match.level,
    message: limitHitRecently ? 'ChatGPT reported a usage limit in this window.' : match.message,
  }
}

/** Compact duration such as "45m" or "2h 10m". */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(1, Math.round(ms / 60_000))
  if (totalMinutes < 60) return `${totalMinutes}m`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`
}
