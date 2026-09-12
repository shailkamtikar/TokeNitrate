// Minimal in-memory stand-in for chrome.storage.local (plus a slice of
// chrome.runtime), for tests that exercise storage-backed modules
// (usageStore, conversationUsageStore, conversationSync) without a real
// extension environment.
type ChangeListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: chrome.storage.AreaName,
) => void

export interface FakeChromeStorageHandle {
  uninstall: () => void
  data: Record<string, unknown>
  /** Makes subsequent storage.local.get/set calls throw `error`, and flips
   * `chrome.runtime.id` to undefined — simulating the extension context
   * being invalidated by a reload/update. */
  invalidateExtensionContext: (error?: Error) => void
  /** Makes subsequent storage.local.get/set calls throw `error` without
   * touching `chrome.runtime.id` — simulating a genuine storage failure
   * that is NOT related to the extension context being invalidated. */
  failStorageWith: (error: Error) => void
}

export function installFakeChromeStorage(): FakeChromeStorageHandle {
  const data: Record<string, unknown> = {}
  const listeners = new Set<ChangeListener>()
  let failure: Error | null = null
  const runtime: { id: string | undefined } = { id: 'fake-extension-id' }

  function get(keys?: string | string[] | null): Promise<Record<string, unknown>> {
    if (failure) throw failure
    const result: Record<string, unknown> = {}
    if (keys == null) {
      Object.assign(result, data)
    } else if (typeof keys === 'string') {
      if (keys in data) result[keys] = data[keys]
    } else {
      for (const key of keys) {
        if (key in data) result[key] = data[key]
      }
    }
    return Promise.resolve(result)
  }

  function set(items: Record<string, unknown>): Promise<void> {
    if (failure) throw failure
    const changes: Record<string, chrome.storage.StorageChange> = {}
    for (const [key, newValue] of Object.entries(items)) {
      changes[key] = { oldValue: data[key], newValue }
      data[key] = newValue
    }
    for (const listener of listeners) listener(changes, 'local')
    return Promise.resolve()
  }

  const fakeChrome = {
    runtime,
    storage: {
      local: { get, set },
      onChanged: {
        addListener: (listener: ChangeListener) => listeners.add(listener),
        removeListener: (listener: ChangeListener) => listeners.delete(listener),
      },
    },
  }

  const previousChrome = (globalThis as { chrome?: unknown }).chrome
  ;(globalThis as { chrome?: unknown }).chrome = fakeChrome

  return {
    data,
    invalidateExtensionContext(error = new Error('Extension context invalidated.')) {
      failure = error
      runtime.id = undefined
    },
    failStorageWith(error: Error) {
      failure = error
    },
    uninstall() {
      ;(globalThis as { chrome?: unknown }).chrome = previousChrome
    },
  }
}
