export function LimitsExplainer() {
  return (
    <details className="card card--enter explainer" style={{ animationDelay: '140ms' }}>
      <summary className="explainer__summary">
        <span>What are these two limits?</span>
        <svg className="explainer__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className="explainer__body">
        <div className="explainer__item">
          <strong>Context limit · one chat</strong>
          <p>
            Each chat can only hold so much text, files and replies at once. This is about size, so a
            long message uses far more of it than a short one. A new chat starts from zero.
          </p>
        </div>
        <div className="explainer__item">
          <strong>Usage limit · all chats</strong>
          <p>
            Your account also has an allowance over a few hours, shared across every chat. We add up
            what you type, attach and receive, and compare it to an estimated budget. Old usage drops
            out of the window as time passes.
          </p>
        </div>
        <p className="note">
          OpenAI doesn&apos;t publish either number for free accounts, so both are estimates. The
          usage budget gets more accurate the first times ChatGPT tells you a limit was reached.
        </p>
      </div>
    </details>
  )
}
