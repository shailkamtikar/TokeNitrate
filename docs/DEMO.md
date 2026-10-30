# Demo script

A walkthrough that shows every feature. Each step lists what you should see.

## Setup (once)

1. `cd frontend && npm install && npm run build`
2. Chrome → `chrome://extensions` → Developer mode → Load unpacked → `frontend/dist`.
3. Backend (for step 8): `cd backend`, put your key in `.env`, then `uv run uvicorn app.main:app --port 8010`.
4. Open chatgpt.com, log in, **refresh the tab once**.

## Steps

| # | Do this | You should see |
|---|---|---|
| 1 | Click the TokeNitrate icon on a non-ChatGPT tab | "Open ChatGPT to start" |
| 2 | Click it on ChatGPT | The context ring, the usage card and the optimizer |
| 3 | Start typing in the ChatGPT message box | A glowing badge above the box counts tokens, digits rolling as you type |
| 4 | Paste a long paragraph | The number jumps and the badge pulses; the popup shows "Draft (not sent)" |
| 5 | Send a message and wait for the reply | The ring percentage and the "You" / "ChatGPT" split rise; no refresh needed |
| 6 | Attach a file or image, then send | The badge shows "incl. ~N from files" before sending; after sending, "Files" in the popup grows |
| 7 | Open another chat | The ring switches to that chat; the "All chats" card keeps the running total |
| 8 | Type a long, wordy prompt and click **Compress my draft** | Tokens saved and the shortened text; **Use this** inserts it, **Undo** restores it |
| 9 | Stop the backend and click Compress | A friendly "could not reach the server" message |
| 10 | Open Settings (gear icon) | Edit chat capacity, usage budget, window; try an invalid value to see validation; "Clear all usage data" asks for confirmation |
| 11 | Expand "What are these two limits?" | The context limit (one chat) vs the usage limit (all chats) explained |
