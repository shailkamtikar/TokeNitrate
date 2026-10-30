from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, read from environment variables or backend/.env.

    The Gemini key lives only here (and in the untracked .env file). It is
    never sent to the extension, logged, or returned in a response.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash-lite"
    # Comma-separated list of allowed origins, e.g. chrome-extension://<id>.
    allowed_origins: str = ""

    max_text_chars: int = 20_000
    gemini_timeout_seconds: float = 20.0

    rate_limit_per_minute: int = 10
    rate_limit_per_day: int = 100

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
