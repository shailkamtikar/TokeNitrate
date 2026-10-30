import { FREE_TIER_PROFILE } from '../config/modelProfile'

// OpenAI publishes no token budget for free accounts, so the default is our
// own guess. When ChatGPT itself tells the user they hit a limit, the number
// of tokens used in the window at that moment is a real observation of the
// budget; the median of the last few observations replaces the guess.
const OBSERVATIONS_KEY = 'tokenitrate_budget_observations'
const MAX_OBSERVATIONS = 3
const MIN_PLAUSIBLE = 1_000
const MAX_PLAUSIBLE = 200_000

export type BudgetSource = 'override' | 'learned' | 'default'

export interface ResolvedBudget {
  tokens: number
  source: BudgetSource
  samples: number
}

export function sanitizeObservations(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= MIN_PLAUSIBLE)
    .map((v) => Math.min(MAX_PLAUSIBLE, v))
    .slice(-MAX_OBSERVATIONS)
}

export function addObservation(observations: number[], usedTokens: number): number[] {
  if (!Number.isFinite(usedTokens) || usedTokens < MIN_PLAUSIBLE) return observations
  return [...observations, Math.min(MAX_PLAUSIBLE, Math.round(usedTokens))].slice(-MAX_OBSERVATIONS)
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

/** A manual override always wins, then the learned median, then the default guess. */
export function resolveUsageBudget(override: number | null, observations: number[]): ResolvedBudget {
  if (override !== null) return { tokens: override, source: 'override', samples: observations.length }
  if (observations.length > 0) {
    return { tokens: median(observations), source: 'learned', samples: observations.length }
  }
  return { tokens: FREE_TIER_PROFILE.usageBudgetTokens, source: 'default', samples: 0 }
}

export async function getObservations(): Promise<number[]> {
  const result = await chrome.storage.local.get(OBSERVATIONS_KEY)
  return sanitizeObservations(result[OBSERVATIONS_KEY])
}

export async function recordLimitHit(usedTokens: number): Promise<number[]> {
  const next = addObservation(await getObservations(), usedTokens)
  await chrome.storage.local.set({ [OBSERVATIONS_KEY]: next })
  return next
}

export function subscribeToObservations(listener: (observations: number[]) => void): () => void {
  function handleChange(
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: chrome.storage.AreaName,
  ) {
    if (areaName !== 'local') return
    const change = changes[OBSERVATIONS_KEY]
    if (!change) return
    listener(sanitizeObservations(change.newValue))
  }
  chrome.storage.onChanged.addListener(handleChange)
  return () => chrome.storage.onChanged.removeListener(handleChange)
}
