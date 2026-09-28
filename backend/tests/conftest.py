"""
Shared pytest fixtures for the backend test suite.

Worth writing this before a single test file, not after: without a
shared, isolated DB + client fixture, the first three tests anyone on
the team writes will each hand-roll their own setup, and they'll
start interfering with each other's data the moment tests run in the
same CI job. This file exists so `tests/test_fields.py`,
`tests/test_shift_advice.py`, etc. can all assume a clean database and
a ready-to-use HTTP client with zero boilerplate of their own.

Requires a real Postgres+PostGIS instance for tests (see
TEST_DATABASE_URL below) — SQLite can't be swapped in here because
GeoAlchemy2's Geometry column type has no SQLite equivalent. The
docker-compose.yml `db-test` service should point at the same
Postgres image with PostGIS as the main `db` service, just a
different database name/port so test runs never touch dev data.
"""

import asyncio
import os

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import Base, get_db
from app.main import app

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://terrashift:terrashift@localhost:5433/terrashift_test",
)


@pytest.fixture(scope="session")
def event_loop():
    # pytest-asyncio needs one event loop shared across the whole test
    # session so the (session-scoped) engine below isn't torn down and
    # recreated between tests.
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def test_engine():
    engine = create_async_engine(TEST_DATABASE_URL, future=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_engine) -> AsyncSession:
    """
    One session per test, wrapped in a transaction that's rolled back
    at the end — this is what keeps tests independent of each other
    without needing to manually delete rows after every test.
    """
    connection = await test_engine.connect()
    transaction = await connection.begin()
    session_factory = async_sessionmaker(bind=connection, expire_on_commit=False)
    session = session_factory()

    yield session

    await session.close()
    await transaction.rollback()
    await connection.close()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncClient:
    """
    An httpx client wired directly to the FastAPI app in-process (no
    real network socket), with `get_db` swapped out for the test
    session above so every request in a test hits the same
    to-be-rolled-back transaction.
    """
    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture
def sample_field_payload() -> dict:
    """A small, valid square polygon reused across field-related tests
    so no one has to hand-write GeoJSON coordinates per test."""
    return {
        "farmer_id": "11111111-1111-1111-1111-111111111111",
        "name": "Test North Plot",
        "geojson_polygon": {
            "type": "Polygon",
            "coordinates": [[
                [36.80, -1.30],
                [36.81, -1.30],
                [36.81, -1.29],
                [36.80, -1.29],
                [36.80, -1.30],
            ]],
        },
        "crop_history": ["maize"],
    }