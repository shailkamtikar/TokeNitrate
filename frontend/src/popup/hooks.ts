import { useEffect, useState } from 'react'
import { MSG_PING } from '../messaging/protocol'
import {
  getObservations,
  subscribeToObservations,
} from '../usage/budgetCalibration'
import { getLimitHit, subscribeToLimitHit, type LimitHit } from '../usage/limitHit'
import { getLedger, subscribeToLedger, type LedgerEntry } from '../usage/tokenLedger'
import {
  DEFAULT_SETTINGS,
  getSettings,
  subscribeToSettings,
  type Settings,
} from '../settings/settingsStore'

/** Re-renders every `intervalMs` so time-based figures (window usage, countdowns) stay fresh. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

/** Generic "read once, then stay live via storage events" hook. */
function useStoredValue<T>(
  initial: T,
  read: () => Promise<T>,
  subscribe: (listener: (value: T) => void) => () => void,
): T {
  const [value, setValue] = useState<T>(initial)
  useEffect(() => {
    let cancelled = false
    read()
      .then((v) => {
        if (!cancelled) setValue(v)
      })
      .catch(() => undefined)
    const unsubscribe = subscribe((v) => {
      if (!cancelled) setValue(v)
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
    // read/subscribe are module-level functions: stable for the hook's lifetime.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return value
}

export const useSettings = (): Settings =>
  useStoredValue(DEFAULT_SETTINGS, getSettings, subscribeToSettings)

export const useLedger = (): LedgerEntry[] => useStoredValue<LedgerEntry[]>([], getLedger, subscribeToLedger)

export const useBudgetObservations = (): number[] =>
  useStoredValue<number[]>([], getObservations, subscribeToObservations)

export const useLimitHit = (): LimitHit | null =>
  useStoredValue<LimitHit | null>(null, getLimitHit, subscribeToLimitHit)

export type TabStatus = 'loading' | 'not-chatgpt' | 'needs-reload' | 'ready'

const CHATGPT_HOSTS = ['chatgpt.com', 'chat.openai.com']

export function isChatGptUrl(url: string | undefined): boolean {
  if (!url) return false
  try {
    const host = new URL(url).hostname
    return CHATGPT_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
  } catch {
    return false
  }
}

/**
 * Works out whether the popup was opened on ChatGPT and whether TokeNitrate's
 * content script is running in that tab. A tab opened before the extension
 * was installed or reloaded has no script until it is refreshed once.
 */
export function useTabStatus(): TabStatus {
  const [status, setStatus] = useState<TabStatus>('loading')
  useEffect(() => {
    let cancelled = false
    const finish = (next: TabStatus) => {
      if (!cancelled) setStatus(next)
    }
    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(async ([tab]) => {
        if (!tab || !isChatGptUrl(tab.url)) return finish('not-chatgpt')
        try {
          await chrome.tabs.sendMessage(tab.id!, { type: MSG_PING })
          finish('ready')
        } catch {
          finish('needs-reload')
        }
      })
      .catch(() => finish('not-chatgpt'))
    return () => {
      cancelled = true
    }
  }, [])
  return status
}
