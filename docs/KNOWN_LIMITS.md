# Known limits

TokeNitrate is an estimator. These are the things it cannot know or does only approximately.

## Accuracy

- **Tokenizer.** Messages are counted with `o200k_base`. The model ChatGPT actually uses for a free account can change, and ChatGPT adds hidden tokens (system prompt, tools, reasoning) that are invisible on the page. Expect the numbers to be close, not exact.
- **Chat capacity (16,000 tokens).** A third-party estimate of the free-tier context size, not an official figure. It is editable in Settings.
- **Usage budget (30,000 tokens per 5 hours).** OpenAI publishes no token budget. The default is a guess. When ChatGPT itself shows a usage-limit notice, the extension records how many tokens had been counted and uses the median of the last three observations as the budget. The usage-limit notice text has not been observed on the live site, so that detection is loose and unverified until a limit is actually hit.
- **Attachments.** Estimated from file size and type (images by size bucket, text about 4 bytes per token, PDFs and Office files by a flat ratio). Accuracy is roughly 80-90% for typical files and worse for unusual ones (scanned PDFs, huge spreadsheets).
- **Generated images are not counted.** When ChatGPT creates an image, only the request and the caption text are counted. The image's token cost depends on its size and level of detail, and OpenAI doesn't publish it, so the extension does not guess. Images you upload are estimated by file size.
- **Files already in a chat.** Attachments are only counted when the extension sees them being sent. Files sent before the extension was installed are not counted.

## Behaviour

- **One refresh after install.** Chrome does not inject extensions into tabs that were already open. Refresh the ChatGPT tab once; the popup tells you if it's needed.
- **Live only for the usage limit.** The usage-limit meter counts what you send and receive while the extension is running. Chat history that is already on the page when you open or reload a chat is not counted toward it.
- **Page changes can break detection.** The extension reads ChatGPT's page structure. Selectors for both the older and the current layout are in `frontend/src/content/chatgpt/selectors.ts`; if ChatGPT changes its markup, that one file is where to fix it. See `docs/dom-notes.md`.
- **Rich message box.** Inserting a shortened prompt works by editing ChatGPT's message box like a user would. If that fails, the text is copied to the clipboard instead.
- **Storage bounds.** Per-chat dedupe records keep the latest 2,000 message ids; chats untouched for 60 days are removed.

## Prompt Optimizer

- Uses one Gemini key on the backend. When the key's free quota is used up, the popup shows "temporarily unavailable". There is no key rotation.
- Draft text is sent to the backend and then to Gemini when you press Compress. Per Google's terms, free-tier content may be used to improve their products.
- The backend is hosted on Render's free tier (`https://tokenitrate-api.onrender.com`). It can take up to a minute to wake after being idle, and all users share one Gemini free-tier quota. To run your own, see `backend/README.md` and change `BACKEND_URL` in `frontend/src/api/compress.ts`.
