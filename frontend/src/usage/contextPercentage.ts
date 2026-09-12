import { getContextCapacityTokens } from '../config/contextCapacity'

export interface ContextUsagePercentage {
  /** Unclamped percentage; can exceed 100 (useful for diagnostics). */
  rawPercent: number
  /** Clamped to [0, 100] — use this for progress bar width. */
  displayPercent: number
  /** Rounded, clamped percentage for text display, e.g. 68. */
  roundedPercent: number
  /** max(0, 100 - roundedPercent). */
  remainingPercent: number
}

/**
 * Computes how full the estimated context capacity is. `estimatedContextTokens`
 * is TokeNitrate's own estimate (see conversationModel.ts), not an official
 * ChatGPT figure, so the result here is an estimate too.
 */
export function calculateContextUsagePercentage(
  estimatedContextTokens: number,
  contextCapacityTokens: number = getContextCapacityTokens(),
): ContextUsagePercentage {
  const safeCapacity = contextCapacityTokens > 0 ? contextCapacityTokens : 1
  const safeTokens = Math.max(0, estimatedContextTokens)

  const rawPercent = (safeTokens / safeCapacity) * 100
  const displayPercent = Math.min(100, Math.max(0, rawPercent))
  const roundedPercent = Math.round(displayPercent)
  const remainingPercent = Math.max(0, 100 - roundedPercent)

  return { rawPercent, displayPercent, roundedPercent, remainingPercent }
}
