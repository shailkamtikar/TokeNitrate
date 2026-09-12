# TokeNitrate

A browser extension that estimates ChatGPT token usage and helps users reduce unnecessary prompt tokens.

**Project status:** Early development. This repository currently contains only the project scaffold — no product features are implemented yet.

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

## Tech stack

- **Frontend**: TypeScript, React, Vite, Chrome Manifest V3
- **Backend**: Python, managed with [uv](https://docs.astral.sh/uv/)

## Important note on token estimates

Any token counts or usage figures shown by this extension are **estimates only**, produced locally/heuristically or via our own backend. They are **not** ChatGPT's official token usage or quota information, and should not be treated as authoritative.
