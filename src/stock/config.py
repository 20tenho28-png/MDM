from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_prefix="STOCK_", extra="ignore"
    )

    # Defaults to the same Postgres instance as the tickets app, but can be
    # pointed elsewhere via STOCK_DATABASE_URL without touching code.
    database_url: str = "postgresql+asyncpg://mdm:mdm@localhost:5432/mdm"

    # Where original purchase-guide files are stored after upload.
    upload_dir: str = "./uploads_guias"

    default_stock_minimo: int = 0
    wall_refresh_seconds: int = 30


@lru_cache
def get_settings() -> Settings:
    return Settings()
