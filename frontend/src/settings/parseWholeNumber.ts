/** Parses a user-typed whole number; blank means "not set". */
export function parseWholeNumber(raw: string): number | null | 'invalid' {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  if (!/^\d+$/.test(trimmed)) return 'invalid'
  return Number(trimmed)
}
