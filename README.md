# TokeNitrate

A browser extension that estimates ChatGPT token usage and helps users reduce unnecessary prompt tokens.

**Project status:** Early development. Text token estimation (Phase 2A) and per-conversation estimated context usage (Phase 2B) are implemented and validated against the live ChatGPT web UI; prompt compression, attachment/PDF/image/audio estimation, and backend (Gemini) integration are not yet implemented.

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
- All figures are **estimates** derived from visible page text, not ChatGPT's official token usage or quota. See the note below.

## Sessions and estimated context usage (current behavior)

- A **TokeNitrate session corresponds to a single ChatGPT conversation**, identified from the conversation id in the ChatGPT page URL (e.g. `chatgpt.com/c/<id>`). Refreshing the page keeps you in the same session; opening or switching to a different conversation — including ChatGPT's in-app navigation between conversations, which doesn't reload the page — starts/resumes a different one. A session is never a daily quota, a subscription limit, a browser session, or a fixed time window.
- The popup's **SESSION** meter shows an **estimated context-usage percentage** for the *current* conversation only — it does not represent usage across all your ChatGPT conversations combined.
- For this first version, `estimatedContextTokens` is approximated as the sum of tokenized **visible** user and assistant text accumulated in the current conversation. TokeNitrate has no access to ChatGPT's hidden system prompts, tool schemas, internal reasoning tokens, or other context it cannot see on the page, so it does not claim to measure those — the estimate can differ from whatever ChatGPT is actually doing internally.
- The percentage is `estimatedContextTokens / contextCapacity`, where **`contextCapacity` is currently a configurable reference value of 128,000 tokens**, TokeNitrate's own approximation for the GPT-5.x "Thinking" context model this build targets — it is **not** an official ChatGPT quota or a guaranteed context window size, and is expected to change as detection improves. It lives behind a single configuration function so it can vary later without touching the UI or calculation code.
- The UI deliberately uses estimation language — "Estimated context usage", "~32% remaining" — and never claims official ChatGPT usage, exact remaining quota, or exact model-internal token consumption.
- At higher usage levels the popup shows a compact, in-place warning (e.g. "Context usage is getting high"); TokeNitrate never claims to know that ChatGPT itself will stop working or get stuck, since it has no way to guarantee that.
- Revisiting a conversation (after a refresh or navigating back to it) restores its previously estimated usage rather than recomputing it from scratch or adding its history again — visible messages are matched against a durable per-message record so the same message is never counted twice.

## Tech stack

- **Frontend**: TypeScript, React, Vite, Chrome Manifest V3
- **Backend**: Python, managed with [uv](https://docs.astral.sh/uv/)

## Important note on token estimates

Any token counts or usage figures shown by this extension are **estimates only**, computed locally from the visible text ChatGPT renders on the page. They are **not** ChatGPT's official token usage or quota information, are not sourced from any private ChatGPT API, and should not be treated as authoritative.
