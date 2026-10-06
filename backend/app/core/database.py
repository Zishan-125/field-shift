"""
Database wiring shared by every model and router in the app.

This file owns exactly three things:
  1. the async engine (process-wide connection pool)
  2. the session factory
  3. `get_db`, the FastAPI dependency every endpoint uses to get a
     transactional session and have it cleaned up automatically
"""

import os
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# Retrieve database URL and auth token from configuration/environment
DATABASE_URL = str(settings.DATABASE_URL)
TURSO_AUTH_TOKEN = getattr(settings, "TURSO_AUTH_TOKEN", os.getenv("TURSO_AUTH_TOKEN", ""))

# Configure engine connection string based on driver protocol
if DATABASE_URL.startswith("libsql://"):
    # Turso Cloud SQLite configuration via libsql driver
    connection_string = f"sqlite+{DATABASE_URL}?auth_token={TURSO_AUTH_TOKEN}&secure=true"
    engine = create_async_engine(
        connection_string,
        echo=settings.ENVIRONMENT == "local",
        connect_args={"check_same_thread": False},
        future=True,
    )
elif DATABASE_URL.startswith("sqlite"):
    # Standard local SQLite configuration
    engine = create_async_engine(
        DATABASE_URL,
        echo=settings.ENVIRONMENT == "local",
        connect_args={"check_same_thread": False},
        future=True,
    )
else:
    # Standard Async PostgreSQL / PostGIS configuration
    engine = create_async_engine(
        DATABASE_URL,
        echo=settings.ENVIRONMENT == "local",  # Log SQL queries in local environment
        pool_pre_ping=True,  # Avoid idle connection drops
        future=True,
    )

# Async session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Every ORM model (Field, Farmer, ShiftScore, ...) inherits from this."""
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency: `db: AsyncSession = Depends(get_db)`.

    Yields one session per request and guarantees it's closed even if
    the endpoint raises — commit/rollback is left to the endpoint itself.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()