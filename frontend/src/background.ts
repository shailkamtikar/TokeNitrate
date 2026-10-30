// TokeNitrate background service worker (MV3). Its only job is to make the
// backend call for the popup, so the network request (and the backend address)
// never touch the ChatGPT page.
import { compressText } from './api/compress'
import { MSG_COMPRESS, type CompressMessage } from './messaging/protocol'

const CLIENT_ID_KEY = 'tokenitrate_client_id'

/** A random id, generated once per install, used only to rate-limit this install server-side. */
async function getClientId(): Promise<string> {
  const stored = await chrome.storage.local.get(CLIENT_ID_KEY)
  const existing = stored[CLIENT_ID_KEY]
  if (typeof existing === 'string' && existing.length >= 8) return existing
  const created = crypto.randomUUID()
  await chrome.storage.local.set({ [CLIENT_ID_KEY]: created })
  return created
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  const msg = message as Partial<CompressMessage> | undefined
  if (msg?.type !== MSG_COMPRESS || typeof msg.text !== 'string') return false

  void compressText(msg.text, { fetchFn: fetch.bind(globalThis), getClientId }).then(sendResponse)
  // Keep the channel open for the async response.
  return true
})
