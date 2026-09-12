/** Formats a raw token count for compact display, e.g. 64200 -> "64.2K". */
export function formatTokenCount(count: number): string {
  if (count < 1000) return String(count)
  if (count < 1_000_000) return `${trimTrailingZero(count / 1000)}K`
  return `${trimTrailingZero(count / 1_000_000)}M`
}

function trimTrailingZero(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '')
}
