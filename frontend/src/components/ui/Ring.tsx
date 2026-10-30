import type { ReactNode } from 'react'

export type Tone = 'ok' | 'warn' | 'danger'

type RingProps = {
  percent: number
  tone: Tone
  size?: number
  label: string
  children?: ReactNode
}

const STROKE = 9

/** Circular progress meter. The arc animates via a CSS transition on stroke-dashoffset. */
export function Ring({ percent, tone, size = 132, label, children }: RingProps) {
  const clamped = Math.min(100, Math.max(0, percent))
  const radius = (size - STROKE) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - clamped / 100)

  return (
    <div
      className={`ring ring--${tone}`}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id={`ring-grad-${tone}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" className="ring__stop-a" />
            <stop offset="100%" className="ring__stop-b" />
          </linearGradient>
        </defs>
        <circle className="ring__track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={STROKE} fill="none" />
        <circle
          className="ring__arc"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={STROKE}
          fill="none"
          stroke={`url(#ring-grad-${tone})`}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring__center">{children}</div>
    </div>
  )
}
