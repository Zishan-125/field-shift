# Builds the image docker-compose.yml's `backend` service runs.
#
# Kept as a single stage (no multi-stage build) on purpose: for a
# hackathon judge running this once, a slightly larger image that's
# easy to read and debug beats a leaner multi-stage build that's
# harder to reason about if something goes wrong at 2am.

FROM python:3.11-slim

WORKDIR /app

# libgeos-dev: required by shapely (used in fields.py's polygon
#   validation and scoring_engine.py's WKB parsing) to build/run its
#   compiled GEOS bindings.
# gcc: some transitive dependencies (e.g. asyncpg on certain
#   platforms) fall back to compiling from source if no matching
#   prebuilt wheel exists for this exact Python/OS combo.
# curl: used below only for the container's own healthcheck.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgeos-dev \
        gcc \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first, install, THEN copy the rest of the app.
# Docker caches layers — this ordering means changing a line in
# app/main.py won't force a full ~2 minute dependency reinstall on
# every rebuild during active development.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

EXPOSE 8000

# Lets `docker compose ps` show this service as (healthy) once /health
# actually responds, instead of just "container is running" — useful
# when a judge is watching `docker compose up` and wondering if it's
# stuck or genuinely still starting.
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
    CMD curl -f http://localhost:8000/health || exit 1

# docker-compose.yml overrides this with --reload for local dev; this
# default (no --reload) is what a non-Compose `docker run` of this
# image would use, and is the safer production-shaped default.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]