import { FREE_TIER_PROFILE } from '../config/modelProfile'

// User-adjustable numbers, stored in chrome.storage.local. Values are
// validated on every read and write; anything invalid or missing falls back
// to the free-tier defaults, so a corrupt record can never break the meters.
const SETTINGS_KEY = 'tokenitrate_settings'

export interface Settings {
  contextCapacityTokens: number
  /** null = use the learned / default budget. */
  usageBudgetTokens: number | null
  usageWindowHours: number
}

export const DEFAULT_SETTINGS: Settings = {
  contextCapacityTokens: FREE_TIER_PROFILE.contextCapacityTokens,
  usageBudgetTokens: null,
  usageWindowHours: FREE_TIER_PROFILE.usageWindowMs / 3_600_000,
}

export const SETTINGS_LIMITS = {
  contextCapacityTokens: { min: 1_000, max: 2_000_000 },
  usageBudgetTokens: { min: 1_000, max: 5_000_000 },
  usageWindowHours: { min: 1, max: 24 },
} as const

function inRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

/** Returns a complete, valid Settings object from untrusted stored data. */
export function normalizeSettings(raw: unknown): Settings {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof Settings, unknown>>
  const L = SETTINGS_LIMITS
  const capacity = input.contextCapacityTokens
  const budget = input.usageBudgetTokens
  const hours = input.usageWindowHours
  return {
    contextCapacityTokens: inRange(capacity, L.contextCapacityTokens.min, L.contextCapacityTokens.max)
      ? Math.round(capacity)
      : DEFAULT_SETTINGS.contextCapacityTokens,
    usageBudgetTokens: inRange(budget, L.usageBudgetTokens.min, L.usageBudgetTokens.max)
      ? Math.round(budget)
      : null,
    usageWindowHours: inRange(hours, L.usageWindowHours.min, L.usageWindowHours.max)
      ? hours
      : DEFAULT_SETTINGS.usageWindowHours,
  }
}

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY)
  return normalizeSettings(result[SETTINGS_KEY])
}

export async function saveSettings(settings: Settings): Promise<Settings> {
  const clean = normalizeSettings(settings)
  await chrome.storage.local.set({ [SETTINGS_KEY]: clean })
  return clean
}

export async function resetSettings(): Promise<void> {
  await chrome.storage.local.remove(SETTINGS_KEY)
}

export function subscribeToSettings(listener: (settings: Settings) => void): () => void {
  function handleChange(
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: chrome.storage.AreaName,
  ) {
    if (areaName !== 'local') return
    const change = changes[SETTINGS_KEY]
    if (!change) return
    listener(normalizeSettings(change.newValue))
  }
  chrome.storage.onChanged.addListener(handleChange)
  return () => chrome.storage.onChanged.removeListener(handleChange)
}
