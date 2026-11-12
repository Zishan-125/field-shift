"""
App-wide settings, loaded once from environment variables (via a
.env file locally, real env vars in any deployed environment).

This is the file `database.py` and `main.py` were already importing
`settings` from — nothing boots without it. Centralizing config here
(instead of scattering `os.getenv()` calls through the codebase) is
what makes `.env.example` in the repo root a complete, reviewable
list of everything a judge needs to configure to run your project.
"""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- core -----------------------------------------------------------
    ENVIRONMENT: str = Field(default="local")  # "local" | "staging" | "production"
    CORS_ORIGINS: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])

    # --- database ---------------------------------------------------------
    # postgresql+asyncpg://user:pass@host:5432/dbname — must point at a
    # Postgres instance with the PostGIS extension enabled.
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://terrashift:terrashift@localhost:5432/terrashift"
    )

    # --- NASA / Earth observation data -------------------------------------
    # Earthdata Login token, used by nasa_data_service.py for SMAP/GPM/
    # ECOSTRESS pulls that go through NASA's own APIs.
    NASA_EARTHDATA_TOKEN: str = Field(default="")
    # Google Earth Engine service-account key (JSON, as a single-line
    # string in the env var) — used for MODIS/Landsat NDVI and the
    # field-polygon raster clipping step.
    GEE_SERVICE_ACCOUNT_JSON: str = Field(default="")

    # --- SMS / USSD gateway ------------------------------------------------
    TWILIO_ACCOUNT_SID: str = Field(default="")
    TWILIO_AUTH_TOKEN: str = Field(default="")
    TWILIO_FROM_NUMBER: str = Field(default="")

    # --- ML-backed scoring (optional upgrade over the rule-based scorer) ---
    # Off by default: the rule-based _composite_score() in
    # scoring_engine.py always works with zero setup. Flip this on once
    # ml-models/*.py have been trained and their .joblib files exist at
    # ML_MODEL_DIR — scoring_engine.py falls back to the rule-based
    # score automatically if the flag is on but a model file is
    # missing, so this is always safe to toggle.
    USE_ML_SCORER: bool = Field(default=False)
    # Path INSIDE THE CONTAINER (or on disk, if running outside Docker)
    # where the trained .joblib files live. docker-compose.yml mounts
    # ml-models/saved_models -> /app/ml_models read-only and sets this
    # env var to match; the default below is for running the backend
    # directly on your machine from the repo root instead.
    ML_MODEL_DIR: str = Field(default="ml-models/saved_models")

    # --- copilot / RAG -------------------------------------------------
    # Local model served via Ollama by default so the demo works with
    # no internet and no API key; swap to a hosted model by changing
    # this and the client in rag_pipeline.py.
    LLM_PROVIDER: str = Field(default="ollama")
    LLM_MODEL_NAME: str = Field(default="llama3")
    OLLAMA_BASE_URL: str = Field(default="http://localhost:11434")


@lru_cache
def get_settings() -> Settings:
    # lru_cache means the .env file is parsed once per process, not
    # once per request — settings are effectively a singleton.
    return Settings()


settings = get_settings()