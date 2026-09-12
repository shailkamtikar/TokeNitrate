type TokenUsageProps = {
  totalTokens: string
}

export function TokenUsage({ totalTokens }: TokenUsageProps) {
  return (
    <section className="token-usage">
      <div className="token-usage__value">{totalTokens}</div>
      <div className="token-usage__label">estimated tokens</div>
    </section>
  )
}
