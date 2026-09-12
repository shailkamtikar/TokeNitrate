type StatCardsProps = {
  inputTokens: string
  outputTokens: string
}

export function StatCards({ inputTokens, outputTokens }: StatCardsProps) {
  return (
    <section className="stat-cards">
      <div className="stat-card">
        <div className="stat-card__label">Input</div>
        <div className="stat-card__value">{inputTokens}</div>
        <div className="stat-card__unit">tokens</div>
      </div>
      <div className="stat-card">
        <div className="stat-card__label">Output</div>
        <div className="stat-card__value">{outputTokens}</div>
        <div className="stat-card__unit">tokens</div>
      </div>
    </section>
  )
}
