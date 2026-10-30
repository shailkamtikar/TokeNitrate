# Architecture

## Pieces

| Piece | Where | Job |
|---|---|---|
| Content script | `frontend/src/content/chatgpt/` | Runs inside chatgpt.com. Watches messages, the message box and attachments; counts tokens; writes numbers to storage. |
| Popup | `frontend/src/popup/`, `components/` | Reads stored numbers and renders the meters, settings and Prompt Optimizer. |
| Background worker | `frontend/src/background.ts` | Makes the backend call for the popup so the network request never touches the ChatGPT page. |
| Backend | `backend/app/` | Holds the Gemini key, validates input, rate-limits each install, calls Gemini. |

## Data flow

1. A user message or a finished ChatGPT reply appears on the page. The message tracker reports it once (deduped by message id, so reloads never double-count).
2. The text is tokenized locally. Per-chat totals go to `tokenitrate_conversation_<id>`; the all-time total to `tokenitrate_usage`.
3. If the message was sent live (not history), tokens are also appended to the **ledger** (`tokenitrate_ledger`) with a timestamp. The usage-limit meter sums the ledger over the rolling window.
4. Attachments the user picks, drops or pastes are held as *pending* (name, type, size only). When the next live message shows those files, their estimated tokens are added to that message and the pending list is cleared.
5. The popup subscribes to `chrome.storage.onChanged`, so it updates live while open.

## Storage keys

All keys are prefixed `tokenitrate_`.

| Key | Contents |
|---|---|
| `usage` | All-time input/output/total tokens |
| `conversation_<id>` | Per-chat totals, attachment tokens, ids already counted |
| `active_conversation` | Which chat the content script is currently in |
| `ledger` | Timestamped token entries (`you` / `files` / `chatgpt`) for the usage window |
| `draft` | Live draft token count (a number, never the text) |
| `budget_observations`, `limit_hit` | Calibration from ChatGPT's own limit notices |
| `settings` | User-edited capacity, budget and window |
| `client_id` | Random id used only for server-side rate limiting |

## Page selectors

ChatGPT-specific page knowledge lives in one file, `content/chatgpt/selectors.ts`, covering both the older and current markup. What was observed on the live site is recorded in [dom-notes.md](dom-notes.md).

## Backend API

`POST /compress` with header `X-Client-Id` and body `{"text": "..."}` returns `{compressed, original_chars, compressed_chars, unchanged}`. Errors are `{code, message}` with codes such as `quota_exhausted`, `rate_limited`, `timeout`, `not_configured`. See [backend/README.md](../backend/README.md).

## Design decisions

- **Numbers only in storage.** No message text is ever persisted.
- **Estimates, honestly labelled.** OpenAI doesn't publish the limits, so every figure says "estimated".
- **Single Gemini key, no rotation.** Rate limits apply per Google project, not per key, so rotating keys wouldn't help and rotating projects to dodge limits is not something we do. When quota runs out, the popup says so.
- **Key on the server.** Anything inside an extension can be extracted, so the Gemini key lives only in the backend's `.env`.
