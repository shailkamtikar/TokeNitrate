# TokeNitrate

A Chrome extension that makes ChatGPT's hidden token usage visible. It counts the tokens in your chats as you type, send and receive, shows two limits (per-chat context and account-wide usage), counts attachments by size, and can shorten a long prompt with Gemini before you send it.

> Every figure is an **estimate** computed locally from what ChatGPT shows on the page. It is not OpenAI's official usage or quota.

## What it does

| Feature | How it works |
|---|---|
| **Live draft counter** | A small animated badge above the message box shows the token count of what you are typing, updating as you type. No refresh needed. |
| **Chat token counting** | Reads your messages and ChatGPT's replies from the page and counts them with the `o200k_base` tokenizer (the one used by GPT-4o / GPT-5 models). |
| **Attachments** | Files you attach are estimated from their size and type only (file contents are never read). Counted once, when the message is sent. |
| **Context limit (one chat)** | A ring meter shows how full the current chat is against an estimated 16,000-token free-tier capacity. |
| **Usage limit (all chats)** | Adds up tokens you typed, attached and received across every chat inside a rolling window (default 5 hours) and compares it with an estimated budget. The budget learns from your own account when ChatGPT reports a limit. |
| **Prompt Optimizer** | Sends your draft to a small backend that asks Gemini (`gemini-3.5-flash-lite`) to shorten it, shows the tokens saved, and lets you insert it into the message box or undo. Nothing is ever sent for you. |
| **Settings** | Change the chat capacity, usage budget and window, or clear all stored usage data. |

### The two limits

| | Context limit | Usage limit |
|---|---|---|
| Scope | One chat | Your whole account, across all chats |
| Measured in | Tokens in that chat | Tokens used in a rolling window |
| Frees up | Start a new chat | Old usage ages out of the window |

OpenAI publishes neither number for free accounts, so both are estimates and are labelled that way in the UI.

## Project layout

```
TokeNitrate/
├─ frontend/                 Chrome extension (React + TypeScript + Vite, Manifest V3)
│  ├─ public/                manifest.json and icons
│  └─ src/
│     ├─ content/chatgpt/    code that runs inside the ChatGPT tab
│     │  ├─ draft/           live draft counter, badge, composer reader/writer
│     │  └─ attachments/     attachment capture and matching
│     ├─ usage/              stores and pure calculations (ledger, limits, budget)
│     ├─ settings/           user settings and validation
│     ├─ tokenizer/          o200k_base token counting
│     ├─ attachments/        size-based attachment estimator
│     ├─ api/ messaging/     backend client and popup/page message types
│     ├─ popup/ components/  popup UI
│     ├─ styles/             design tokens and component styles
│     └─ config/             one place for all tunable numbers
├─ backend/                  FastAPI service that calls Gemini (the API key lives only here)
│  ├─ app/                   API code
│  └─ tests/
└─ docs/                     DOM notes, demo script, known limits
```

## Run it

### Extension

```
cd frontend
npm install
npm run build
```

Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked** and choose `frontend/dist`. Then **refresh any open ChatGPT tab once**. After that, everything updates live.

### Backend (only needed for the Prompt Optimizer)

```
cd backend
cp .env.example .env      # put your GEMINI_API_KEY in .env (never commit it)
uv sync
uv run uvicorn app.main:app --port 8010
```

### Tests

```
cd frontend && npm test && npm run lint
cd backend  && uv run pytest
```

## Privacy

- Token counting, attachment estimates and limits run entirely in your browser. File contents are never read.
- Only numbers are stored (in `chrome.storage.local`), never message text. The draft text is only used to count it.
- Text leaves the browser only when you press **Compress my draft**: it goes to the backend, which sends it to Gemini. The Gemini API key is never inside the extension.

See [docs/KNOWN_LIMITS.md](docs/KNOWN_LIMITS.md) for accuracy notes and [docs/DEMO.md](docs/DEMO.md) for a walkthrough.

## Tech

React 19, TypeScript, Vite, Vitest, `js-tiktoken`, Chrome Manifest V3; Python 3.11+, FastAPI, `google-genai`, managed with `uv`.
