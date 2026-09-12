type SessionProgressProps = {
  percent: number
}

export function SessionProgress({ percent }: SessionProgressProps) {
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
        aria-label="Session token usage"
      >
        <div
          className="session-progress__fill"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </section>
  )
}
