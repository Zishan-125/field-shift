"""
TerraShift backend entrypoint.

Responsibilities of this file ONLY:
  1. create the FastAPI app
  2. wire up startup/shutdown (DB engine lifecycle)
  3. mount CORS so the web + mobile clients can call the API
  4. include feature routers under /api/v1 and offline routes under /api/offline
  5. expose health check endpoints for app and graders
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
    Handles optional local DB auto-creation and engine disposal.
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

# Primary API v1 Routers
app.include_router(fields.router, prefix="/api/v1/fields", tags=["fields"])
app.include_router(shift_advice.router, prefix="/api/v1/shift-advice", tags=["shift-advice"])
app.include_router(copilot.router, prefix="/api/v1/copilot", tags=["copilot"])
app.include_router(sms_webhook.router, prefix="/api/v1/sms", tags=["sms"])


@app.get("/health", tags=["system"])
@app.get("/api/offline/health", tags=["system"])
async def health_check():
    """
    Liveness probe endpoint supporting both /health and /api/offline/health.
    """
    return {"status": "ok", "service": "terrashift-api", "version": app.version}