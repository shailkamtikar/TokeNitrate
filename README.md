# TokeNitrate

A browser extension that estimates ChatGPT token usage and helps users reduce unnecessary prompt tokens.

**Project status:** Early development. Text token estimation (Phase 2A) is implemented and has been validated against the live ChatGPT web UI; prompt compression, attachment/PDF/image/audio estimation, and backend (Gemini) integration are not yet implemented.

## Problem

ChatGPT does not surface how many tokens a conversation or prompt is consuming. Users have no visibility into which parts of their usage (long prompts, repeated context, large attachments, etc.) are driving cost or hitting rate limits, and no lightweight way to trim unnecessary tokens before sending a message.

## Planned features

- Estimate token usage for prompts and conversations in the ChatGPT web UI
- Surface estimates inline as the user types
- Suggest ways to reduce unnecessary prompt tokens
- (Longer term) Attachment-aware estimation and usage tracking over time

## Architecture (initial)

- **Frontend**: a Chromium browser extension (Manifest V3) that integrates with the ChatGPT web UI and displays token estimates.
- **Backend**: a Python API service that will handle server-side work — including calls to the Gemini API — so that production credentials are never embedded in the extension.

The extension and backend communicate over HTTPS; the extension itself holds no API keys.

## Token estimation (current behavior)

- A content script observes the ChatGPT web UI (`chatgpt.com` / `chat.openai.com`) and reads the **visible text** of user messages and completed assistant messages from the page DOM. It does not call any ChatGPT API and has no access to official usage/quota data.
- Each message's visible text is tokenized in the browser using **`o200k_base`**, the tiktoken encoding used by GPT-5-family and GPT-4o-family models, via a pure-JavaScript tokenizer (no server round-trip, no Python `tiktoken`).
- User messages are counted once, as soon as they're submitted. Assistant messages stream into the page, so a message is only counted once its text has stopped changing for a short interval — this avoids counting a single response multiple times while it's still being generated.
- Running totals (input tokens, output tokens, total tokens) are stored locally via `chrome.storage.local` and shown in the popup.
- The **session usage percentage** shown in the popup is currently a **fixed placeholder value**, not derived from real usage — it exists to preview the UI until a real usage-budget/session model is defined.
- All figures are **estimates** derived from visible page text, not ChatGPT's official token usage or quota. See the note below.

## Tech stack

- **Frontend**: TypeScript, React, Vite, Chrome Manifest V3
- **Backend**: Python, managed with [uv](https://docs.astral.sh/uv/)

## Important note on token estimates

Any token counts or usage figures shown by this extension are **estimates only**, computed locally from the visible text ChatGPT renders on the page. They are **not** ChatGPT's official token usage or quota information, are not sourced from any private ChatGPT API, and should not be treated as authoritative.
