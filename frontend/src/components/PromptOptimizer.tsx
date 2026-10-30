import { useCompress } from '../popup/useCompress'
import { AnimatedNumber } from './ui/AnimatedNumber'

type PromptOptimizerProps = {
  /** Estimated tokens currently in the ChatGPT message box. */
  draftTokens: number
}

export function PromptOptimizer({ draftTokens }: PromptOptimizerProps) {
  const { state, compress, apply, undo, reset } = useCompress()
  const working = state.status === 'working'

  return (
    <section className="card card--enter optimizer" style={{ animationDelay: '210ms' }}>
      <div className="card__head">
        <h2 className="card__title">Prompt Optimizer</h2>
        <span className="chip">Gemini</span>
      </div>

      {(state.status === 'idle' || state.status === 'working') && (
        <>
          <p className="note optimizer__lead">
            Shorten what you&apos;ve typed while keeping its meaning. Your draft is sent to Gemini
            through the TokeNitrate server to be rewritten.
          </p>
          <button type="button" className="btn btn--primary btn--block" onClick={compress} disabled={working}>
            {working ? (
              <span className="btn__busy">
                <i className="spinner" aria-hidden="true" /> Shortening…
              </span>
            ) : draftTokens > 0 ? (
              `Compress my draft (${draftTokens.toLocaleString('en-US')} tokens)`
            ) : (
              'Compress my draft'
            )}
          </button>
        </>
      )}

      {state.status === 'error' && (
        <>
          <p className="alert alert--warn" role="alert">{state.message}</p>
          <div className="actions">
            <button type="button" className="btn btn--primary" onClick={compress}>Try again</button>
            <button type="button" className="btn" onClick={reset}>Dismiss</button>
          </div>
        </>
      )}

      {state.status === 'result' && (
        <div className="result">
          {state.unchanged ? (
            <p className="alert alert--ok">Already concise, nothing to shorten.</p>
          ) : (
            <>
              <div className="result__saved">
                <span className="result__big mono">
                  −<AnimatedNumber value={Math.max(0, state.tokensBefore - state.tokensAfter)} />
                </span>
                <span className="result__small">
                  tokens ({state.tokensBefore.toLocaleString('en-US')} → {state.tokensAfter.toLocaleString('en-US')},{' '}
                  {state.tokensBefore > 0
                    ? Math.round(((state.tokensBefore - state.tokensAfter) / state.tokensBefore) * 100)
                    : 0}
                  % shorter)
                </span>
              </div>
              <blockquote className="result__text">{state.compressed}</blockquote>
            </>
          )}

          {state.applied === 'inserted' && <p className="alert alert--ok" role="status">Inserted into the message box. Nothing was sent.</p>}
          {state.applied === 'copied' && <p className="alert alert--ok" role="status">Couldn&apos;t edit the box, so it&apos;s copied. Paste it in.</p>}
          {state.applied === 'failed' && <p className="alert alert--warn" role="alert">Couldn&apos;t insert or copy. Select the text above and copy it.</p>}
          {state.applied === 'undone' && <p className="alert alert--ok" role="status">Original draft restored.</p>}

          <div className="actions">
            {!state.unchanged && (state.applied === null || state.applied === 'undone') && (
              <button type="button" className="btn btn--primary" onClick={apply}>Use this</button>
            )}
            {!state.unchanged && state.applied === 'inserted' && (
              <button type="button" className="btn" onClick={undo}>Undo</button>
            )}
            <button type="button" className="btn" onClick={reset}>Done</button>
          </div>
        </div>
      )}
    </section>
  )
}
