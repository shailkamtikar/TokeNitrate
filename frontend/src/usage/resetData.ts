const PREFIX = 'tokenitrate_'
const SETTINGS_KEY = 'tokenitrate_settings'

/**
 * Deletes everything TokeNitrate has stored (usage totals, per-chat records,
 * the usage ledger, calibration data), keeping the user's settings. Only
 * keys with the extension's own prefix are touched.
 */
export async function clearUsageData(): Promise<number> {
  const all = await chrome.storage.local.get(null)
  const keys = Object.keys(all).filter((key) => key.startsWith(PREFIX) && key !== SETTINGS_KEY)
  if (keys.length > 0) await chrome.storage.local.remove(keys)
  return keys.length
}
