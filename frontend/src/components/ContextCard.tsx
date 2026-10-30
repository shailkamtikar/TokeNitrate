import type { ContextView } from '../popup/viewModel'
import { formatTokenCount } from '../usage/formatTokenCount'
import { Breakdown } from './Breakdown'
import { AnimatedNumber } from './ui/AnimatedNumber'
import { Ring } from './ui/Ring'

type ContextCardProps = {
  view: ContextView
  /** False on the new-chat page, before a conversation exists. */
  hasChat: boolean
}

export function ContextCard({ view, hasChat }: ContextCardProps) {
  return (
    <section className="card card--enter" style={{ animationDelay: '0ms' }}>
      <div className="card__head">
        <h2 className="card__title">This chat</h2>
        <span className="chip">Context limit</span>
      </div>

      <div className="context">
        <Ring percent={hasChat ? view.percent : 0} tone={view.tone} label="Estimated context usage for this chat">
          <div className="ring__value">
            <AnimatedNumber value={hasChat ? view.percent : 0} format={(v) => `${Math.round(v)}`} />
            <small>%</small>
          </div>
          <div className="ring__sub">of ~{formatTokenCount(view.capacity)}</div>
        </Ring>

        <div className="context__side">
          <div className="metric">
            <span className="metric__label">
              Estimated tokens
              {view.streaming && <span className="live-dot" title="ChatGPT is replying"> live</span>}
            </span>
            <span className="metric__value mono">
              <AnimatedNumber value={hasChat ? view.tokens : 0} />
            </span>
          </div>
          <div className="metric">
            <span className="metric__label">Left in this chat</span>
            <span className="metric__value mono">~{hasChat ? view.remainingPercent : 100}%</span>
          </div>
          {view.draft > 0 && (
            <div className="metric metric--draft">
              <span className="metric__label">Draft (not sent)</span>
              <span className="metric__value mono">
                +<AnimatedNumber value={view.draft} />
              </span>
            </div>
          )}
        </div>
      </div>

      {hasChat ? (
        <Breakdown
          items={[
            { key: 'you', label: 'You', value: view.you, color: '--accent' },
            { key: 'files', label: 'Files', value: view.files, color: '--accent-2', hint: 'by size' },
            { key: 'gpt', label: 'ChatGPT', value: view.chatgpt, color: '--chat' },
          ]}
        />
      ) : (
        <p className="note">Start or open a chat and its token usage shows up here.</p>
      )}

      {hasChat && view.message && <p className={`alert alert--${view.tone}`}>{view.message}</p>}
    </section>
  )
}
