"""
Database wiring shared by every model and router in the app.

This file owns exactly three things:
  1. the async engine (one process-wide connection pool to Postgres)
  2. the session factory
  3. `get_db`, the FastAPI dependency every endpoint uses to get a
     transactional session and have it cleaned up automatically

Nothing domain-specific belongs here — no Field, no scoring logic.
That separation is what let fields.py (previous file) import
`get_db` and `Base` without needing to know how the connection is
actually configured.
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# `postgresql+asyncpg://` — asyncpg is the driver; PostGIS itself is just
# a Postgres extension, so no special engine config is needed for it
# beyond making sure `CREATE EXTENSION postgis;` has been run once on
# the database (docker-compose's init script does this for the demo).
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.ENVIRONMENT == "local",  # log SQL locally, stay quiet in prod
    pool_pre_ping=True,  # avoids "server closed the connection" after idle periods
    future=True,
)

# expire_on_commit=False matters here: without it, accessing a row's
# attributes (e.g. row.name) after `await db.commit()` triggers a
# lazy-load that fails outside the session context — a classic async
# SQLAlchemy footgun that shows up as a confusing MissingGreenlet error.
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
    the endpoint raises — commit/rollback is left to the endpoint
    itself so it can decide the transaction boundary explicitly
    (see create_field/update_field in fields.py).
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()