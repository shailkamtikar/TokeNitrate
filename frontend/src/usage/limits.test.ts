// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installFakeChromeStorage, type FakeChromeStorageHandle } from '../testUtils/fakeChromeStorage'
import {
  addObservation,
  getObservations,
  median,
  recordLimitHit,
  resolveUsageBudget,
  sanitizeObservations,
} from './budgetCalibration'
import { formatDuration, getUsageLimitState } from './limitState'
import { limitHitInWindow } from './limitHit'
import { looksLikeLimitMessage } from '../content/chatgpt/limitWatcher'
import { DEFAULT_SETTINGS, normalizeSettings } from '../settings/settingsStore'
import {
  appendToLedger,
  getLedger,
  LEDGER_MAX_AGE_MS,
  nextFreeUpAt,
  sanitizeLedger,
  tokensInWindow,
} from './tokenLedger'

const HOUR = 3_600_000
const NOW = 1_000_000_000_000

describe('token ledger (pure)', () => {
  const entries = [
    { t: NOW - 6 * HOUR, kind: 'you' as const, tokens: 500 },
    { t: NOW - 3 * HOUR, kind: 'you' as const, tokens: 100 },
    { t: NOW - 2 * HOUR, kind: 'files' as const, tokens: 255 },
    { t: NOW - 1 * HOUR, kind: 'chatgpt' as const, tokens: 400 },
  ]

  it('sums only the entries inside the window, with a breakdown', () => {
    expect(tokensInWindow(entries, 5 * HOUR, NOW)).toEqual({ total: 755, you: 100, files: 255, chatgpt: 400 })
  })
  it('counts long messages far more than short ones', () => {
    const long = tokensInWindow([{ t: NOW, kind: 'you', tokens: 1500 }], HOUR, NOW).total
    const short = tokensInWindow([{ t: NOW, kind: 'you', tokens: 8 }], HOUR, NOW).total
    expect(long).toBeGreaterThan(short * 100)
  })
  it('reports when the oldest in-window usage frees up', () => {
    expect(nextFreeUpAt(entries, 5 * HOUR, NOW)).toBe(NOW - 3 * HOUR + 5 * HOUR)
  })
  it('returns null when nothing is in the window', () => {
    expect(nextFreeUpAt([], 5 * HOUR, NOW)).toBeNull()
  })
  it('treats corrupt storage as empty', () => {
    expect(sanitizeLedger('garbage', NOW)).toEqual([])
    expect(sanitizeLedger([{ t: 'x' }, null, { t: NOW, kind: 'you', tokens: -1 }], NOW)).toEqual([])
  })
  it('drops entries older than the maximum age', () => {
    expect(sanitizeLedger([{ t: NOW - LEDGER_MAX_AGE_MS - 1, kind: 'you', tokens: 5 }], NOW)).toEqual([])
  })
})

describe('token ledger (storage)', () => {
  let storage: FakeChromeStorageHandle
  beforeEach(() => {
    storage = installFakeChromeStorage()
  })
  afterEach(() => storage.uninstall())

  it('appends entries across chats and ignores non-positive amounts', async () => {
    await appendToLedger([{ kind: 'you', tokens: 10 }, { kind: 'files', tokens: 0 }])
    await appendToLedger([{ kind: 'chatgpt', tokens: 20 }])
    const ledger = await getLedger()
    expect(ledger.map((e) => e.kind)).toEqual(['you', 'chatgpt'])
  })
  it('serializes concurrent appends without losing entries', async () => {
    await Promise.all(Array.from({ length: 20 }, () => appendToLedger([{ kind: 'you', tokens: 1 }])))
    expect(await getLedger()).toHaveLength(20)
  })
})

describe('usage limit state', () => {
  it('is normal when nothing is used', () => {
    expect(getUsageLimitState(0, 30_000).level).toBe('normal')
  })
  it('reaches high at 75%', () => {
    expect(getUsageLimitState(22_500, 30_000).level).toBe('high')
  })
  it('is reached at and above 100% without negative remaining', () => {
    const state = getUsageLimitState(39_000, 30_000)
    expect(state.level).toBe('capacityReached')
    expect(state.remainingPercent).toBe(0)
    expect(state.percent).toBe(100)
  })
  it('a reported limit overrides a low estimate', () => {
    const state = getUsageLimitState(100, 30_000, true)
    expect(state.level).toBe('capacityReached')
    expect(state.percent).toBe(100)
  })
  it('never divides by zero', () => {
    expect(Number.isFinite(getUsageLimitState(10, 0).percent)).toBe(true)
  })
  it('formats durations compactly', () => {
    expect(formatDuration(30 * 60_000)).toBe('30m')
    expect(formatDuration(2 * HOUR + 10 * 60_000)).toBe('2h 10m')
    expect(formatDuration(3 * HOUR)).toBe('3h')
  })
  it('knows whether a reported limit is still inside the window', () => {
    expect(limitHitInWindow({ at: NOW - HOUR, usedTokens: 1 }, 5 * HOUR, NOW)).toBe(true)
    expect(limitHitInWindow({ at: NOW - 6 * HOUR, usedTokens: 1 }, 5 * HOUR, NOW)).toBe(false)
    expect(limitHitInWindow(null, 5 * HOUR, NOW)).toBe(false)
  })
})

describe('budget calibration', () => {
  it('uses the default guess with no observations', () => {
    expect(resolveUsageBudget(null, [])).toEqual({ tokens: 30_000, source: 'default', samples: 0 })
  })
  it('learns from a single observation', () => {
    expect(resolveUsageBudget(null, [22_000])).toEqual({ tokens: 22_000, source: 'learned', samples: 1 })
  })
  it('uses the median of three', () => {
    expect(median([20_000, 24_000, 40_000])).toBe(24_000)
  })
  it('ignores implausibly small observations', () => {
    expect(addObservation([], 400)).toEqual([])
  })
  it('clamps implausibly large observations', () => {
    expect(addObservation([], 900_000)).toEqual([200_000])
  })
  it('keeps only the last three', () => {
    expect(addObservation([1_000, 2_000, 3_000], 4_000)).toEqual([2_000, 3_000, 4_000])
  })
  it('a manual override always wins', () => {
    expect(resolveUsageBudget(10_000, [22_000]).tokens).toBe(10_000)
    expect(resolveUsageBudget(10_000, [22_000]).source).toBe('override')
  })
  it('sanitizes corrupt stored data', () => {
    expect(sanitizeObservations('x')).toEqual([])
    expect(sanitizeObservations([5, 'a', 5000])).toEqual([5000])
  })
  it('persists observations', async () => {
    const storage = installFakeChromeStorage()
    await recordLimitHit(25_000)
    await recordLimitHit(500)
    expect(await getObservations()).toEqual([25_000])
    storage.uninstall()
  })
})

describe('settings validation', () => {
  it('falls back to defaults for missing or invalid data', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings({ contextCapacityTokens: -5, usageWindowHours: 'abc', usageBudgetTokens: 0 })).toEqual(
      DEFAULT_SETTINGS,
    )
  })
  it('accepts valid values', () => {
    expect(normalizeSettings({ contextCapacityTokens: 8000, usageBudgetTokens: 12_000, usageWindowHours: 3 })).toEqual({
      contextCapacityTokens: 8000,
      usageBudgetTokens: 12_000,
      usageWindowHours: 3,
    })
  })
})

describe('limit message detection', () => {
  it('detects typical limit notices', () => {
    expect(looksLikeLimitMessage("You've reached the free plan limit for GPT-5. Try again at 4:30 PM.")).toBe(true)
    expect(looksLikeLimitMessage('You have hit your message cap')).toBe(true)
  })
  it('ignores normal text and very long text', () => {
    expect(looksLikeLimitMessage('How do I set a speed limit in my game?')).toBe(false)
    expect(looksLikeLimitMessage('you reached the limit '.repeat(50))).toBe(false)
    expect(looksLikeLimitMessage('')).toBe(false)
  })
})
