import { useEffect, useRef, useState } from 'react'

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

type AnimatedNumberProps = {
  value: number
  /** Formats the in-between and final value; defaults to thousands separators. */
  format?: (value: number) => string
  durationMs?: number
}

/** Counts smoothly from the previous value to the new one (React Bits-style count-up). */
export function AnimatedNumber({
  value,
  format = (v) => Math.round(v).toLocaleString('en-US'),
  durationMs = 600,
}: AnimatedNumberProps) {
  const [shown, setShown] = useState(value)
  const fromRef = useRef(value)
  const frameRef = useRef(0)

  useEffect(() => {
    if (prefersReducedMotion() || fromRef.current === value) {
      fromRef.current = value
      setShown(value)
      return
    }
    const from = fromRef.current
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = from + (value - from) * eased
      fromRef.current = current
      setShown(current)
      if (progress < 1) frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [value, durationMs])

  return <span className="num">{format(shown)}</span>
}
