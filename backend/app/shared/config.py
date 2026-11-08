"""Application settings — config read only from the five D-24 env vars."""
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import Field, SecretStr, field_validator
from pydantic.fields import FieldInfo
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    # .env always lives at the repo root, but the app is run from backend/,
    # so the path must be absolute instead of cwd-relative.
    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parents[3] / ".env"), extra="ignore"
    )

    DATABASE_URL: str
    TEST_DATABASE_URL: str | None = None
    SESSION_SECRET: SecretStr
    ALLOWED_ORIGINS: Annotated[list[str], NoDecode] = ["http://localhost:5173"]
    LOG_LEVEL: str = "INFO"

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def _split_origins(cls, value):
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
