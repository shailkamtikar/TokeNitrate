export type ContextWarningLevel = 'normal' | 'moderate' | 'high' | 'critical' | 'capacityReached'

export interface ContextWarning {
  level: ContextWarningLevel
  /** null when there's nothing worth surfacing yet (normal level). */
  message: string | null
  /**
   * Whether a future "compress this prompt" action would be relevant here.
   * No compression feature exists yet — this only marks the threshold so a
   * later phase can wire an action into the warning without touching this
   * threshold logic.
   */
  suggestCompression: boolean
}

interface WarningThreshold {
  min: number
  level: ContextWarningLevel
  message: string | null
  suggestCompression: boolean
}

// Checked in this (descending) order so the first matching threshold is the
// highest one the percentage qualifies for.
const THRESHOLDS: WarningThreshold[] = [
  {
    min: 100,
    level: 'capacityReached',
    message:
      'Estimated context capacity reached — consider starting a new chat or compressing your prompt.',
    suggestCompression: true,
  },
  {
    min: 90,
    level: 'critical',
    message:
      'High context usage — long or complex responses may become incomplete. Consider starting a new chat or compressing your prompt.',
    suggestCompression: true,
  },
  {
    min: 75,
    level: 'high',
    message: 'Context usage is getting high.',
    suggestCompression: true,
  },
  {
    min: 50,
    level: 'moderate',
    message: 'Halfway through estimated context capacity.',
    suggestCompression: false,
  },
  {
    min: 0,
    level: 'normal',
    message: null,
    suggestCompression: false,
  },
]

/** Maps a rounded, clamped context-usage percentage to a warning level and copy. */
export function getContextWarning(roundedPercent: number): ContextWarning {
  const clamped = Math.max(0, roundedPercent)
  const threshold =
    THRESHOLDS.find((candidate) => clamped >= candidate.min) ?? THRESHOLDS[THRESHOLDS.length - 1]
  const { level, message, suggestCompression } = threshold
  return { level, message, suggestCompression }
}
