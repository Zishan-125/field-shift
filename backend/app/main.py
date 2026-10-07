"""
TerraShift backend entrypoint.

Responsibilities of this file ONLY:
  1. create the FastAPI app
  2. wire up startup/shutdown (DB engine lifecycle)
  3. mount CORS so the web + mobile clients can call the API
  4. include every feature router under /api/v1
  5. expose a health check judges/graders can hit in demo mode

Everything domain-specific (DB models, scoring logic, NASA data pulls)
intentionally lives OUTSIDE this file — main.py should stay thin and
readable in under a minute.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import engine, Base

from app.api import fields, shift_advice, copilot, sms_webhook


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Runs once when the server boots and once when it shuts down.
    In a hackathon build this is where you'd normally call
    Base.metadata.create_all() for a quick local demo DB; in a real
    deployment you'd swap that for Alembic migrations run beforehand.
    """
    try:
        async with engine.begin() as conn:
            if getattr(settings, "ENVIRONMENT", "local") == "local":
                await conn.run_sync(Base.metadata.create_all)
        print("Database connected and schema initialized successfully.")
    except Exception as e:
        print(f"Warning: Could not connect to PostgreSQL ({e}). Running in offline/demo mode.")

    yield  # app runs here

    await engine.dispose()


app = FastAPI(
    title="TerraShift API",
    description="NASA-EO-powered crop rotation & shift advisory backend",
    version="0.1.0",
    lifespan=lifespan,
)

# Parse or fallback allowed origins
cors_origins = getattr(settings, "CORS_ORIGINS", ["*"])
if isinstance(cors_origins, str):
    cors_origins = [origin.strip() for origin in cors_origins.split(",") if origin.strip()]

# Explicitly ensure production frontend origins are allowed
allowed_origins = list(cors_origins)
if "https://field-shift-five.vercel.app" not in allowed_origins and "*" not in allowed_origins:
    allowed_origins.append("https://field-shift-five.vercel.app")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if allowed_origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Each router owns one bounded concern of the product.
app.include_router(fields.router, prefix="/api/v1/fields", tags=["fields"])
app.include_router(shift_advice.router, prefix="/api/v1/shift-advice", tags=["shift-advice"])
app.include_router(copilot.router, prefix="/api/v1/copilot", tags=["copilot"])
app.include_router(sms_webhook.router, prefix="/api/v1/sms", tags=["sms"])


@app.get("/health", tags=["system"])
async def health_check():
    """
    Cheap liveness probe. Also useful as the very first thing you show
    judges: hit this endpoint to prove the one-command Docker setup
    actually came up before diving into the real demo.
    """
    return {"status": "ok", "service": "terrashift-api", "version": app.version}