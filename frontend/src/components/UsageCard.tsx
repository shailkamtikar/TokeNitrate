import type { UsageView } from '../popup/viewModel'
import { formatDuration } from '../usage/limitState'
import { formatTokenCount } from '../usage/formatTokenCount'
import { Breakdown } from './Breakdown'
import { AnimatedNumber } from './ui/AnimatedNumber'

type UsageCardProps = {
  view: UsageView
  now: number
}

function budgetLabel(view: UsageView): string {
  if (view.budgetSource === 'override') return 'budget set by you'
  if (view.budgetSource === 'learned') {
    return `budget learned from ${view.samples} limit hit${view.samples === 1 ? '' : 's'}`
  }
  return 'default estimate'
}

export function UsageCard({ view, now }: UsageCardProps) {
  const freesUp = view.freesUpAt !== null ? formatDuration(Math.max(0, view.freesUpAt - now)) : null

  return (
    <section className="card card--enter" style={{ animationDelay: '70ms' }}>
      <div className="card__head">
        <h2 className="card__title">All chats · last {view.windowHours}h</h2>
        <span className="chip">Usage limit</span>
      </div>

      <div className="usage__top">
        <div className="usage__figure mono">
          <AnimatedNumber value={view.used} />
          <small> / ~{formatTokenCount(view.budget)} tokens</small>
        </div>
        <span className={`pct pct--${view.tone}`}>
          <AnimatedNumber value={view.percent} format={(v) => `${Math.round(v)}%`} />
        </span>
      </div>

      <div
        className={`bar bar--${view.tone}`}
        role="progressbar"
        aria-valuenow={view.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Estimated usage across all chats in the current window"
      >
        <span className="bar__fill" style={{ width: `${view.percent}%` }} />
      </div>

      <Breakdown
        items={[
          { key: 'you', label: 'Typed', value: view.you, color: '--accent' },
          { key: 'files', label: 'Files', value: view.files, color: '--accent-2' },
          { key: 'gpt', label: 'ChatGPT replies', value: view.chatgpt, color: '--chat' },
        ]}
      />

      <p className="note">
        {freesUp ? `Oldest usage frees up in ~${freesUp}. ` : 'Nothing counted in this window yet. '}
        <span className="muted">({budgetLabel(view)})</span>
      </p>
      {view.message && <p className={`alert alert--${view.tone}`}>{view.message}</p>}
    </section>
  )
}
