# TokeNitrate Backend

Small FastAPI service that shortens prompts with Gemini, so the API key never ships inside the browser extension.

## Setup

```
cp .env.example .env      # then put your key in .env (never commit it)
uv sync
```

`.env` values:

| Variable | Meaning |
|---|---|
| `GEMINI_API_KEY` | Your Gemini API key. Used only by this server. |
| `GEMINI_MODEL` | Defaults to `gemini-3.5-flash-lite`. |
| `ALLOWED_ORIGINS` | Optional comma-separated origins, e.g. `chrome-extension://<id>`. By default any `chrome-extension://` origin is allowed. |

## Run

```
uv run uvicorn app.main:app --port 8010
```

## API

- `GET /health` returns `{"status": "ok"}`.
- `POST /compress` with header `X-Client-Id: <random id, 8-64 chars>` and body `{"text": "..."}`.
  Returns `{compressed, original_chars, compressed_chars, unchanged}`.

Errors are JSON `{code, message}`: `invalid_request` (422), `text_too_long` (422), `missing_client_id` (400), `rate_limited` (429), `quota_exhausted` (429), `timeout` (504), `upstream_error` (502), `not_configured` (503).

The service uses one key only. When its free-tier quota runs out it answers `quota_exhausted` and the extension shows a friendly message. Requests are rate-limited per client id (10/min, 100/day by default).
Prompt text is never logged or stored.

## Tests

```
uv run pytest
```
