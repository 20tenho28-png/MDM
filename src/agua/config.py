from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_prefix="AGUA_", extra="ignore"
    )

    # Defaults to the same Postgres instance as the other services.
    database_url: str = "postgresql+asyncpg://mdm:mdm@localhost:5432/mdm"

    overpass_url: str = "https://overpass-api.de/api/interpreter"
    overpass_timeout_seconds: int = 300

    # Map defaults (roughly centred on mainland Portugal).
    map_center_lat: float = 39.6
    map_center_lon: float = -8.0
    map_zoom: int = 7


@lru_cache
def get_settings() -> Settings:
    return Settings()
