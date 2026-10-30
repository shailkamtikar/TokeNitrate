import { FREE_TIER_PROFILE } from './modelProfile'

/**
 * Reference figure for how much context a single conversation has to work
 * with, used as the denominator of the estimated context-usage meter.
 *
 * This is NOT an official ChatGPT number — see modelProfile.ts. It stays
 * behind this function so it can later come from user settings.
 */
export function getContextCapacityTokens(): number {
  return FREE_TIER_PROFILE.contextCapacityTokens
}
