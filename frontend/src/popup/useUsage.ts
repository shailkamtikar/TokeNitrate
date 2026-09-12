import { useEffect, useState } from 'react'
import { EMPTY_USAGE, type UsageTotals } from '../usage/usageModel'
import { getUsage, subscribeToUsage } from '../usage/usageStore'

/** Reads the stored usage totals and keeps them live while the popup is open. */
export function useUsage(): UsageTotals {
  const [usage, setUsage] = useState<UsageTotals>(EMPTY_USAGE)

  useEffect(() => {
    let cancelled = false

    getUsage().then((value) => {
      if (!cancelled) setUsage(value)
    })

    const unsubscribe = subscribeToUsage((value) => {
      if (!cancelled) setUsage(value)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return usage
}
