import { describe, expect, it } from 'vitest'
import { calculateContextUsagePercentage } from './contextPercentage'

describe('calculateContextUsagePercentage', () => {
  it('computes the percentage of the given capacity', () => {
    const result = calculateContextUsagePercentage(64_000, 128_000)
    expect(result.rawPercent).toBe(50)
    expect(result.displayPercent).toBe(50)
    expect(result.roundedPercent).toBe(50)
  })

  it('rounds the displayed percentage', () => {
    const result = calculateContextUsagePercentage(1, 3)
    expect(result.roundedPercent).toBe(Math.round((1 / 3) * 100))
  })

  it('clamps the display percentage at 100 while keeping the raw value uncapped', () => {
    const result = calculateContextUsagePercentage(256_000, 128_000)
    expect(result.rawPercent).toBe(200)
    expect(result.displayPercent).toBe(100)
    expect(result.roundedPercent).toBe(100)
  })

  it('never returns a negative percentage for zero usage', () => {
    const result = calculateContextUsagePercentage(0, 128_000)
    expect(result.rawPercent).toBe(0)
    expect(result.displayPercent).toBe(0)
    expect(result.roundedPercent).toBe(0)
  })

  it('never returns a negative percentage for negative input', () => {
    const result = calculateContextUsagePercentage(-500, 128_000)
    expect(result.rawPercent).toBeGreaterThanOrEqual(0)
    expect(result.displayPercent).toBeGreaterThanOrEqual(0)
  })

  it('computes remaining as max(0, 100 - roundedPercent)', () => {
    const result = calculateContextUsagePercentage(96_000, 128_000)
    expect(result.roundedPercent).toBe(75)
    expect(result.remainingPercent).toBe(25)
  })

  it('floors remaining at 0 once capacity is exceeded', () => {
    const result = calculateContextUsagePercentage(200_000, 128_000)
    expect(result.remainingPercent).toBe(0)
  })

  it('uses the configured default capacity when none is given', () => {
    const withDefault = calculateContextUsagePercentage(64_000)
    const withExplicit = calculateContextUsagePercentage(64_000, 128_000)
    expect(withDefault).toEqual(withExplicit)
  })
})
