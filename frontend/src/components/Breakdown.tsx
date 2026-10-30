import { AnimatedNumber } from './ui/AnimatedNumber'

export type BreakdownItem = {
  key: string
  label: string
  value: number
  /** CSS custom property name holding the segment colour. */
  color: string
  hint?: string
}

type BreakdownProps = {
  items: BreakdownItem[]
}

/** A stacked proportion bar plus a legend with animated values. */
export function Breakdown({ items }: BreakdownProps) {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.value), 0)

  return (
    <div className="breakdown">
      <div className="breakdown__bar" role="img" aria-label={items.map((i) => `${i.label} ${i.value}`).join(', ')}>
        {total === 0 ? (
          <span className="breakdown__empty" />
        ) : (
          items.map((item) => (
            <span
              key={item.key}
              className="breakdown__seg"
              style={{ flexGrow: Math.max(0, item.value), background: `var(${item.color})` }}
            />
          ))
        )}
      </div>
      <ul className="breakdown__legend">
        {items.map((item) => (
          <li key={item.key} className="breakdown__row">
            <span className="breakdown__dot" style={{ background: `var(${item.color})` }} />
            <span className="breakdown__label">{item.label}</span>
            {item.hint && <span className="breakdown__hint">{item.hint}</span>}
            <span className="breakdown__value">
              <AnimatedNumber value={item.value} durationMs={450} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
