export function PromptOptimizer() {
  return (
    <section className="card card--enter optimizer" style={{ animationDelay: '210ms' }}>
      <div className="card__head">
        <h2 className="card__title">Prompt Optimizer</h2>
        <span className="chip">Soon</span>
      </div>
      <p className="note">Shorten a long prompt while keeping its meaning.</p>
      <button type="button" className="btn btn--primary" disabled>
        Compress my draft
      </button>
    </section>
  )
}
