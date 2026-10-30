# ChatGPT DOM notes

Observed on 2026-10-30 in the built-in browser, **logged out**, `https://chatgpt.com/`, viewport 1400x900, language `en-US`. Read-only inspection: no message was sent, nothing was typed or uploaded.

## Logged-out composer (verified)

| Item | Finding |
|---|---|
| Composer | `<textarea id="mobile-composer-prompt" name="prompt" data-mobile-composer-prompt aria-label="Chat with ChatGPT" placeholder="Ask ChatGPT">` (a plain textarea, **not** a ProseMirror contenteditable) |
| `#prompt-textarea` | **Absent** (0 matches). The selector currently assumed for the logged-in app does not exist here |
| Send button | `button[type=submit][aria-label="Send message"]`; also an element with id `lightweight-composer-send` |
| File inputs | `#octane-mobile-composer-photos-input` (`image/*`), `#octane-mobile-composer-files-input` (images only: avif, bmp, gif, heic, heif, jpeg, png, webp), `#octane-mobile-composer-camera-input` (`image/*`) |
| Attachment limits (logged out) | Files input accepts **images only**. The page text says: "Log in to ... upload files" |
| Class names | Atomic hashed classes (`x1abc...`). **Do not select by class** |
| Stable-looking hooks | ids prefixed `lightweight-composer*` and `octane-mobile-composer*`; `data-mobile-composer-prompt`; `name="prompt"`; `aria-label` values |
| Messages | Not yet observed (no message sent). Existing code assumes `[data-message-author-role]`; unverified here |

## Consequences for the plan

1. The composer reader (Milestone 1.1) must handle **both** a `textarea` (`.value`) and a `contenteditable` (`.textContent`), and use an ordered selector list: `#prompt-textarea`, `textarea[name=prompt]`, `#mobile-composer-prompt`, then `[contenteditable=true][role=textbox]`.
2. Attachment capture (Milestone 2.2) listens for `change` on **any** `input[type=file]`, so it works regardless of id.
3. Writing a compressed prompt back (Milestone 6.3) differs per type: textarea needs the native value setter plus an `input` event; contenteditable needs `execCommand('insertText')`.
4. Logged-out limits differ from a logged-in free account, so the usage-limit message and budget cannot be verified from here.

## Still unverified (needs a message sent or a logged-in session)

- Selector for user/assistant messages in this layout
- How a sent image attachment appears inside the user message
- The text and markup of ChatGPT's own limit message
- Whether the logged-in free layout uses `#prompt-textarea`

---

## Logged-in free account (verified 2026-10-30, read-only, on the first-run "Welcome" chat)

| Item | Finding |
|---|---|
| Composer | `div[contenteditable=true][role=textbox][aria-label="Ask ChatGPT"]` with attributes `data-composer-markdown`, `aria-multiline=true`. **No `id`**, and `#prompt-textarea` is **absent** |
| File inputs | 4 inputs with auto-generated ids like `_r_3s_` (unstable): `image/*` single, `image/*,video/*` multiple, `image/*` multiple, and one with **no accept filter** (any file). Selecting by id is not possible; use `input[type=file]` |
| `[data-message-author-role]` | **0 matches**, even though a message is displayed. The attribute the current extension relies on is not present on this page |
| Assistant message text | Inside `div[data-markdown-text-style="assistant-message"]` |
| Message id | On an ancestor: `data-chatgpt-selection-message-id="<uuid>"` and `data-chatgpt-selection-conversation-id` |
| Turn wrapper | `data-chatgpt-search-unit-key="fallback-turn-0:0:assistant"`; page-wide data attributes seen: `data-id`, `data-testid`, `data-turn-key` |
| Send/stop buttons | None matched while the composer was empty (the send button likely only renders once text exists) |

### Caveat
This was a first-run welcome message (its unit key says `fallback-turn-0`), which may be rendered differently from a normal chat turn. A real user message and reply must be inspected before selectors are finalized.

### Implication
The tracker in `selectors.ts` (`[data-message-author-role]`, `data-message-id`) may no longer match the current ChatGPT UI. If a normal chat shows the same, text counting is currently broken and Phase 0 must fix selectors before anything else.


---

## Real chat turn (logged in, verified 2026-10-30)

After one test message ("hi") and its reply:

| Item | Finding |
|---|---|
| User message | Text lives in `div[data-user-message-bubble="true"]` (inside `.whitespace-pre-wrap`). Its id is on an ancestor: `data-chatgpt-search-message-ids="<uuid>"` (also used as the turn's `data-turn-key`) |
| Assistant message | `div[data-markdown-text-style="assistant-message"]`, with `data-chatgpt-selection-message-id="<uuid>"` on an ancestor |
| Older attribute | `[data-message-author-role]` / `data-message-id` were **not present** in this layout, so `selectors.ts` supports both the old and the new markup |
| Composer | `div[contenteditable=true][role=textbox]` (ProseMirror: one `<p>` per line; `<p class="placeholder" data-empty-paragraph>` when empty) |
| Message action buttons | `aria-label`s such as "Copy", "Edit message", "Regenerate response" exist; the send button was not matched while the box was empty |

Still unverified: how a sent attachment appears inside a user turn (the extension matches by file name, or an image thumbnail), and the text/markup of ChatGPT's own usage-limit notice.
