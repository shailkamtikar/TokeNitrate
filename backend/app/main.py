from fastapi import FastAPI, Header
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import Settings, get_settings
from app.gemini import (
    GeminiClient,
    GoogleGeminiClient,
    NotConfiguredError,
    QuotaExhaustedError,
    UpstreamError,
    UpstreamTimeoutError,
)
from app.ratelimit import RateLimiter
from app.schemas import CompressRequest, CompressResponse


def _error(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"code": code, "message": message})


def create_app(settings: Settings | None = None, client: GeminiClient | None = None) -> FastAPI:
    settings = settings or get_settings()
    client = client or GoogleGeminiClient(
        settings.gemini_api_key, settings.gemini_model, settings.gemini_timeout_seconds
    )
    limiter = RateLimiter(settings.rate_limit_per_minute, settings.rate_limit_per_day)

    app = FastAPI(title="TokeNitrate API")

    # Only the extension (and explicitly configured origins) may call this API
    # from a browser page. Extension service workers with host permission are
    # not subject to CORS; this protects against arbitrary web pages.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.origins,
        allow_origin_regex=r"^chrome-extension://[a-p]{32}$" if not settings.origins else None,
        allow_methods=["POST", "GET"],
        allow_headers=["Content-Type", "X-Client-Id"],
    )

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_request, _exc: RequestValidationError) -> JSONResponse:
        # Never echo the submitted text back in an error body.
        return _error(422, "invalid_request", "The request body is not valid.")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/compress", response_model=CompressResponse)
    async def compress(body: CompressRequest, x_client_id: str | None = Header(default=None)):
        if not x_client_id or not (8 <= len(x_client_id) <= 64):
            return _error(400, "missing_client_id", "A valid X-Client-Id header is required.")
        if len(body.text) > settings.max_text_chars:
            return _error(422, "text_too_long", f"Text is longer than {settings.max_text_chars} characters.")
        if not limiter.allow(x_client_id):
            return _error(429, "rate_limited", "Too many requests. Please wait a moment and try again.")

        original = body.text
        try:
            shortened = await client.shorten(original)
        except NotConfiguredError:
            return _error(503, "not_configured", "The compression service is not configured yet.")
        except QuotaExhaustedError:
            return _error(429, "quota_exhausted", "Compression is temporarily unavailable. Try again later.")
        except UpstreamTimeoutError:
            return _error(504, "timeout", "The model took too long to answer.")
        except UpstreamError:
            return _error(502, "upstream_error", "The compression service had a problem.")

        shortened = shortened.strip()
        # Only accept a result that is a genuine shortening.
        if not shortened or len(shortened) >= len(original):
            return CompressResponse(
                compressed=original,
                original_chars=len(original),
                compressed_chars=len(original),
                unchanged=True,
            )
        return CompressResponse(
            compressed=shortened,
            original_chars=len(original),
            compressed_chars=len(shortened),
            unchanged=False,
        )

    return app


app = create_app()
