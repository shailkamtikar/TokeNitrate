from fastapi.testclient import TestClient

from app.config import Settings
from app.gemini import (
    FakeGeminiClient,
    NotConfiguredError,
    QuotaExhaustedError,
    UpstreamError,
    UpstreamTimeoutError,
)
from app.main import create_app
from app.ratelimit import RateLimiter

CLIENT_ID = {"X-Client-Id": "11111111-aaaa-bbbb-cccc-222222222222"}
LONG = "Please could you kindly   help me   to write a very short summary of this text, thank you so much!"


def make(client=None, **overrides):
    settings = Settings(gemini_api_key="test", **overrides)
    fake = client or FakeGeminiClient()
    return TestClient(create_app(settings, fake)), fake


def test_health():
    c, _ = make()
    assert c.get("/health").json() == {"status": "ok"}


def test_compress_happy_path():
    c, fake = make(FakeGeminiClient(reply="Write a short summary."))
    r = c.post("/compress", json={"text": LONG}, headers=CLIENT_ID)
    assert r.status_code == 200
    body = r.json()
    assert body["compressed"] == "Write a short summary."
    assert body["unchanged"] is False
    assert body["compressed_chars"] < body["original_chars"]
    assert fake.calls == [LONG]


def test_already_short_text_is_returned_unchanged():
    c, _ = make(FakeGeminiClient(reply="Hi there, how are you doing today my friend"))
    r = c.post("/compress", json={"text": "Hi"}, headers=CLIENT_ID)
    assert r.json()["unchanged"] is True
    assert r.json()["compressed"] == "Hi"


def test_model_returning_empty_text_is_unchanged():
    c, _ = make(FakeGeminiClient(reply="   "))
    assert c.post("/compress", json={"text": LONG}, headers=CLIENT_ID).json()["unchanged"] is True


def test_empty_text_is_rejected():
    c, _ = make()
    assert c.post("/compress", json={"text": ""}, headers=CLIENT_ID).status_code == 422


def test_wrong_type_is_rejected_without_echoing_input():
    c, _ = make()
    r = c.post("/compress", json={"text": 5}, headers=CLIENT_ID)
    assert r.status_code == 422
    assert r.json()["code"] == "invalid_request"


def test_text_over_the_limit_is_rejected():
    c, _ = make(max_text_chars=50)
    r = c.post("/compress", json={"text": "x" * 51}, headers=CLIENT_ID)
    assert r.status_code == 422
    assert r.json()["code"] == "text_too_long"


def test_missing_or_short_client_id_is_rejected():
    c, _ = make()
    assert c.post("/compress", json={"text": LONG}).status_code == 400
    assert c.post("/compress", json={"text": LONG}, headers={"X-Client-Id": "abc"}).status_code == 400


def test_quota_exhausted_maps_to_429():
    c, _ = make(FakeGeminiClient(error=QuotaExhaustedError()))
    r = c.post("/compress", json={"text": LONG}, headers=CLIENT_ID)
    assert r.status_code == 429
    assert r.json()["code"] == "quota_exhausted"


def test_timeout_maps_to_504():
    c, _ = make(FakeGeminiClient(error=UpstreamTimeoutError()))
    assert c.post("/compress", json={"text": LONG}, headers=CLIENT_ID).status_code == 504


def test_upstream_failure_maps_to_502_without_details():
    c, _ = make(FakeGeminiClient(error=UpstreamError("secret detail")))
    r = c.post("/compress", json={"text": LONG}, headers=CLIENT_ID)
    assert r.status_code == 502
    assert "secret" not in r.text


def test_missing_key_maps_to_503():
    c, _ = make(FakeGeminiClient(error=NotConfiguredError()))
    r = c.post("/compress", json={"text": LONG}, headers=CLIENT_ID)
    assert r.status_code == 503
    assert r.json()["code"] == "not_configured"


def test_rate_limit_per_minute():
    c, _ = make(rate_limit_per_minute=3)
    codes = [c.post("/compress", json={"text": LONG}, headers=CLIENT_ID).status_code for _ in range(4)]
    assert codes == [200, 200, 200, 429]


def test_rate_limit_is_per_client():
    c, _ = make(rate_limit_per_minute=1)
    other = {"X-Client-Id": "99999999-aaaa-bbbb-cccc-000000000000"}
    assert c.post("/compress", json={"text": LONG}, headers=CLIENT_ID).status_code == 200
    assert c.post("/compress", json={"text": LONG}, headers=other).status_code == 200


def test_limiter_daily_cap_and_window_expiry():
    now = [0.0]
    limiter = RateLimiter(per_minute=100, per_day=2, clock=lambda: now[0])
    assert limiter.allow("a") and limiter.allow("a")
    assert not limiter.allow("a")
    now[0] = 90_000.0
    assert limiter.allow("a")


def test_cors_allows_extension_origin_and_blocks_web_pages():
    c, _ = make()
    ext = "chrome-extension://" + "a" * 32
    ok = c.options(
        "/compress",
        headers={"Origin": ext, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"},
    )
    assert ok.headers.get("access-control-allow-origin") == ext
    bad = c.options(
        "/compress",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"},
    )
    assert "access-control-allow-origin" not in bad.headers


def test_api_key_is_never_in_a_response():
    c, _ = make(FakeGeminiClient(reply="Short."))
    r = c.post("/compress", json={"text": LONG}, headers=CLIENT_ID)
    assert "test" not in r.headers.get("access-control-allow-origin", "")
    assert "gemini_api_key" not in r.text.lower()
