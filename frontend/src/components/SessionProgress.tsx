import type { ContextWarningLevel } from '../usage/warningState'

type SessionProgressProps = {
  percent: number
  remainingPercent: number
  warningLevel: ContextWarningLevel
  warningMessage: string | null
}

export function SessionProgress({
  percent,
  remainingPercent,
  warningLevel,
  warningMessage,
}: SessionProgressProps) {
  const clamped = Math.min(100, Math.max(0, percent))

  return (
    <section className="session-progress">
      <div className="session-progress__header">
        <span className="session-progress__label">Session</span>
        <span className="session-progress__percent">{clamped}%</span>
      </div>
      <div
        className="session-progress__track"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Estimated context usage for the current conversation"
      >
        <div
          className="session-progress__fill"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <div className="session-progress__remaining">~{remainingPercent}% remaining</div>
      {warningMessage && (
        <p className={`session-progress__warning session-progress__warning--${warningLevel}`}>
          {warningMessage}
        </p>
      )}
    </section>
  )
}
