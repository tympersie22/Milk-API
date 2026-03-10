from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Milki API"
    environment: str = "development"
    api_v1_prefix: str = "/v1"
    secret_key: str
    database_url: str = "sqlite+pysqlite:///./milki.db"
    redis_url: str = "redis://localhost:6379/0"
    pii_encryption_key: str
    allowed_api_key_prefix: str = "mlk_"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()


def parse_cors_origins(raw: str) -> list[str]:
    return [origin.strip() for origin in raw.split(",") if origin.strip()]
