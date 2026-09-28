"""
The scheduled job behind the "dags/" folder in the tree. Its purpose
is easy to state and easy to justify: at 2am every day, recompute the
Field Shift Score for every registered field, so that when a farmer
or judge opens the dashboard at 9am, the score loads instantly from
`ShiftScore` cache instead of making them wait 5-10 seconds for a
live Earth Engine round trip.

It works by calling the backend's OWN `/recompute` endpoint per field
— the same one api/shift_advice.py already exposes — rather than
reimplementing the scoring logic here. That means there is exactly
one place in the entire codebase that knows how to turn NASA signals
into a score (scoring_engine.py), and this file, the dashboard, and
the SMS webhook are all just callers of it.

Written as a plain async script so it runs identically two ways:
  1. Hackathon-simple: a cron entry -> `python dags/refresh_daily.py`
  2. Production-shaped: wrapped in an Airflow PythonOperator, shown
     at the bottom, with zero changes to the logic above it.
"""

import asyncio
import logging
import sys
from datetime import datetime, timezone

import httpx

BACKEND_URL = "http://localhost:8000"
REQUEST_TIMEOUT = httpx.Timeout(60.0)  # GEE calls are slow; give each field room to finish
MAX_CONCURRENT_REFRESHES = 3  # stay well under Earth Engine's per-project rate limits

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("refresh_daily")


async def _fetch_all_field_ids(client: httpx.AsyncClient) -> list[str]:
    response = await client.get("/api/v1/fields")
    response.raise_for_status()
    return [field["id"] for field in response.json()]


async def _refresh_one_field(client: httpx.AsyncClient, field_id: str, semaphore: asyncio.Semaphore) -> tuple[str, bool, str]:
    async with semaphore:
        try:
            response = await client.post(f"/api/v1/shift-advice/{field_id}/recompute")
            response.raise_for_status()
            score = response.json()["field_shift_score"]
            return field_id, True, f"score={score}"
        except httpx.HTTPError as exc:
            return field_id, False, str(exc)


async def run_refresh(backend_url: str = BACKEND_URL) -> None:
    started_at = datetime.now(timezone.utc)
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_REFRESHES)

    async with httpx.AsyncClient(base_url=backend_url, timeout=REQUEST_TIMEOUT) as client:
        field_ids = await _fetch_all_field_ids(client)
        logger.info("Refreshing %d field(s)...", len(field_ids))

        results = await asyncio.gather(
            *[_refresh_one_field(client, fid, semaphore) for fid in field_ids]
        )

    succeeded = [r for r in results if r[1]]
    failed = [r for r in results if not r[1]]

    for field_id, _, detail in failed:
        logger.warning("Field %s failed to refresh: %s", field_id, detail)

    duration = (datetime.now(timezone.utc) - started_at).total_seconds()
    logger.info(
        "Refresh complete in %.1fs — %d succeeded, %d failed",
        duration, len(succeeded), len(failed),
    )

    if failed and len(failed) == len(results):
        # Every field failing usually means the backend or Earth Engine
        # itself is down, not that individual fields have bad data —
        # exit non-zero so a cron/Airflow failure actually gets noticed.
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run_refresh())


# ---------------------------------------------------------------------
# Production upgrade path (not needed for the hackathon demo): wrap
# the same run_refresh() in an Airflow DAG so failures show up in
# Airflow's UI/alerting instead of a bare cron log file. Uncomment and
# adjust once/if the project moves past hackathon infra:
#
# from airflow import DAG
# from airflow.operators.python import PythonOperator
# from datetime import timedelta
#
# with DAG(
#     "terrashift_refresh_daily",
#     schedule_interval="0 2 * * *",  # 2am daily
#     start_date=datetime(2026, 1, 1),
#     catchup=False,
#     default_args={"retries": 2, "retry_delay": timedelta(minutes=10)},
# ) as dag:
#     PythonOperator(task_id="refresh_all_fields", python_callable=lambda: asyncio.run(run_refresh()))