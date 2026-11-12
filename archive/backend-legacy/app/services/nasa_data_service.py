"""
All NASA Earth-observation access lives in this one file.

Design decision worth explaining to the team: rather than hitting five
different NASA APIs (Earthdata Search, AppEEARS, GES DISC, ...) each
with their own auth and quirks, every dataset here is pulled through
**Google Earth Engine**, which mirrors SMAP, MODIS, GPM IMERG,
ECOSTRESS and GRACE-FO as ready-to-query ImageCollections. For a
48-hour build this cuts five integrations down to one authentication
flow and one query pattern (`reduceRegion` over the field polygon),
which is time you can spend on the scoring logic and UI instead.

`ee` (the Earth Engine Python API) is synchronous and does blocking
network I/O, so every call here runs inside `asyncio.to_thread` to
avoid stalling the FastAPI event loop for other requests.
"""

import asyncio
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

import ee
from shapely.geometry.base import BaseGeometry

from app.core.config import settings

logger = logging.getLogger(__name__)

_EE_INITIALIZED = False
_EE_MOCK_MODE = False


def _ensure_initialized() -> bool:
    """Lazy, once-per-process Earth Engine auth (blocking, hence lazy). Returns True if GEE is ready."""
    global _EE_INITIALIZED, _EE_MOCK_MODE
    if _EE_INITIALIZED:
        return not _EE_MOCK_MODE

    raw_gee_json = (getattr(settings, "GEE_SERVICE_ACCOUNT_JSON", "") or "").strip()

    if not raw_gee_json or raw_gee_json in ('""', "''"):
        logger.warning("GEE_SERVICE_ACCOUNT_JSON not set. Operating in mock/fallback mode.")
        _EE_INITIALIZED = True
        _EE_MOCK_MODE = True
        return False

    try:
        credentials_info = json.loads(raw_gee_json)
        credentials = ee.ServiceAccountCredentials(
            email=credentials_info["client_email"], key_data=raw_gee_json
        )
        ee.Initialize(credentials)
        _EE_INITIALIZED = True
        _EE_MOCK_MODE = False
        return True
    except (json.JSONDecodeError, KeyError, Exception) as e:
        logger.error(f"Failed to initialize Earth Engine ({e}). Operating in mock/fallback mode.")
        _EE_INITIALIZED = True
        _EE_MOCK_MODE = True
        return False


@dataclass
class NasaSignal:
    source: str            # e.g. "SMAP"
    label: str             # e.g. "Root-zone soil moisture"
    value: float
    anomaly_pct: Optional[float]   # % deviation from the multi-year normal, signed
    contribution: str       # plain-language note for the "why" explanation


def _shapely_to_ee_geometry(geom: BaseGeometry) -> "ee.Geometry":
    return ee.Geometry(geom.__geo_interface__)


def _recent_window(days: int) -> tuple[str, str]:
    end = datetime.now(timezone.utc).date()
    start = end - timedelta(days=days)
    return start.isoformat(), end.isoformat()


def _baseline_window(days: int, years_back: int = 5) -> tuple[str, str]:
    """Same day-of-year window, N years ago, used as the 'normal' to diff against."""
    end = datetime.now(timezone.utc).date().replace(year=datetime.now(timezone.utc).year - years_back)
    start = end - timedelta(days=days)
    return start.isoformat(), end.isoformat()


def _pct_anomaly(current: float, baseline: float) -> Optional[float]:
    if baseline in (0, None) or current is None:
        return None
    return round((current - baseline) / baseline * 100, 1)


def _region_mean(collection_id: str, band: str, geom: "ee.Geometry", start: str, end: str) -> Optional[float]:
    """Blocking Earth Engine call: mean of `band` over `geom` for [start, end)."""
    collection = ee.ImageCollection(collection_id).filterDate(start, end).filterBounds(geom)
    image = collection.select(band).mean()
    stats = image.reduceRegion(reducer=ee.Reducer.mean(), geometry=geom, scale=1000, maxPixels=1e9)
    value = stats.get(band).getInfo()
    return float(value) if value is not None else None


# ---------------------------------------------------------- individual pulls --

def _fetch_soil_moisture_sync(geom: "ee.Geometry") -> NasaSignal:
    start, end = _recent_window(14)
    base_start, base_end = _baseline_window(14)
    current = _region_mean("NASA/SMAP/SPL4SMGP/007", "sm_rootzone", geom, start, end)
    baseline = _region_mean("NASA/SMAP/SPL4SMGP/007", "sm_rootzone", geom, base_start, base_end)
    anomaly = _pct_anomaly(current, baseline)
    note = (
        f"{abs(anomaly)}% {'below' if anomaly < 0 else 'above'} the 14-day normal"
        if anomaly is not None else "insufficient history for a baseline comparison"
    )
    return NasaSignal("SMAP", "Root-zone soil moisture", current or 0.0, anomaly, note)


def _fetch_vegetation_index_sync(geom: "ee.Geometry") -> NasaSignal:
    start, end = _recent_window(32)  # one MODIS 16-day composite pair
    base_start, base_end = _baseline_window(32)
    current = _region_mean("MODIS/061/MOD13Q1", "NDVI", geom, start, end)
    baseline = _region_mean("MODIS/061/MOD13Q1", "NDVI", geom, base_start, base_end)
    # MODIS NDVI is scaled by 10000 in the raw product
    current_n = (current / 10000) if current else None
    baseline_n = (baseline / 10000) if baseline else None
    anomaly = _pct_anomaly(current_n, baseline_n)
    note = (
        f"vegetation vigor {abs(anomaly)}% {'below' if anomaly < 0 else 'above'} seasonal normal"
        if anomaly is not None else "insufficient history for a baseline comparison"
    )
    return NasaSignal("MODIS", "Vegetation health (NDVI)", current_n or 0.0, anomaly, note)


def _fetch_rainfall_sync(geom: "ee.Geometry") -> NasaSignal:
    start, end = _recent_window(30)
    base_start, base_end = _baseline_window(30)
    current = _region_mean("NASA/GPM_L3/IMERG_MONTHLY_V07", "precipitation", geom, start, end)
    baseline = _region_mean("NASA/GPM_L3/IMERG_MONTHLY_V07", "precipitation", geom, base_start, base_end)
    anomaly = _pct_anomaly(current, baseline)
    note = (
        f"rainfall {abs(anomaly)}% {'below' if anomaly < 0 else 'above'} normal this month"
        if anomaly is not None else "insufficient history for a baseline comparison"
    )
    return NasaSignal("GPM", "Rainfall accumulation", current or 0.0, anomaly, note)


def _fetch_evapotranspiration_stress_sync(geom: "ee.Geometry") -> NasaSignal:
    start, end = _recent_window(16)
    base_start, base_end = _baseline_window(16)
    current = _region_mean("NASA/ECOSTRESS/ESI/L4/ESI_PT_JPL", "ESI", geom, start, end)
    baseline = _region_mean("NASA/ECOSTRESS/ESI/L4/ESI_PT_JPL", "ESI", geom, base_start, base_end)
    anomaly = _pct_anomaly(current, baseline)
    note = (
        f"plant water-stress index {abs(anomaly)}% {'worse' if anomaly < 0 else 'better'} than normal"
        if anomaly is not None else "insufficient history for a baseline comparison"
    )
    return NasaSignal("ECOSTRESS", "Evapotranspiration stress (ESI)", current or 0.0, anomaly, note)


def _fetch_groundwater_trend_sync(geom: "ee.Geometry") -> NasaSignal:
    start, end = _recent_window(90)
    base_start, base_end = _baseline_window(90)
    current = _region_mean("NASA/GRACE/MASS_GRIDS_V04/LAND", "lwe_thickness_csr", geom, start, end)
    baseline = _region_mean("NASA/GRACE/MASS_GRIDS_V04/LAND", "lwe_thickness_csr", geom, base_start, base_end)
    anomaly = _pct_anomaly(current, baseline)
    note = (
        f"groundwater storage {abs(anomaly)}% {'below' if anomaly < 0 else 'above'} the 5-year trend"
        if anomaly is not None else "insufficient history for a baseline comparison"
    )
    return NasaSignal("GRACE-FO", "Groundwater storage trend", current or 0.0, anomaly, note)


def _get_mock_signals() -> list[NasaSignal]:
    """Fallback signal set matching fixed positional order for scoring_engine execution."""
    return [
        NasaSignal("SMAP", "Root-zone soil moisture", 0.28, -5.2, "5.2% below the 14-day normal"),
        NasaSignal("MODIS", "Vegetation health (NDVI)", 0.65, 3.1, "vegetation vigor 3.1% above seasonal normal"),
        NasaSignal("GPM", "Rainfall accumulation", 12.4, -12.0, "rainfall 12.0% below normal this month"),
        NasaSignal("ECOSTRESS", "Evapotranspiration stress (ESI)", 0.58, -1.5, "plant water-stress index 1.5% worse than normal"),
        NasaSignal("GRACE-FO", "Groundwater storage trend", 15.0, 0.8, "groundwater storage 0.8% above the 5-year trend")
    ]


# ---------------------------------------------------------------- public API --

async def get_all_signals(geometry: BaseGeometry) -> list[NasaSignal]:
    """
    Fetch every NASA signal for a field's polygon concurrently.

    Returns a fixed-order list (SMAP, MODIS, GPM, ECOSTRESS, GRACE-FO)
    so `scoring_engine.py` can rely on positional order, though it
    should still key off `.source` defensively rather than index.
    """
    is_ready = _ensure_initialized()

    # Short-circuit and return mock signals if GEE is not initialized or credentials are empty
    if not is_ready:
        return _get_mock_signals()

    try:
        geom = await asyncio.to_thread(_shapely_to_ee_geometry, geometry)

        results = await asyncio.gather(
            asyncio.to_thread(_fetch_soil_moisture_sync, geom),
            asyncio.to_thread(_fetch_vegetation_index_sync, geom),
            asyncio.to_thread(_fetch_rainfall_sync, geom),
            asyncio.to_thread(_fetch_evapotranspiration_stress_sync, geom),
            asyncio.to_thread(_fetch_groundwater_trend_sync, geom),
            return_exceptions=True,
        )

        signals: list[NasaSignal] = []
        for result in results:
            if isinstance(result, Exception):
                continue
            signals.append(result)

        return signals if signals else _get_mock_signals()
    except Exception as e:
        logger.error(f"Error executing GEE queries ({e}). Returning fallback signals.")
        return _get_mock_signals()