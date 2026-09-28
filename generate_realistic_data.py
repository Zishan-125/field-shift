"""
NOT part of the product — a stand-in for gee_field_clip.py's real
output, used only to verify the training scripts actually run
end-to-end before you have real GEE credentials wired up. Matches the
exact CSV schema gee_field_clip.py writes: field_id, date, dataset,
value, one row per (field, date, dataset).

Simulates 8 fields over 5 years at MODIS's native ~16-day cadence,
including one field with a sustained multi-month drought (so the
"weak label" logic in stress_risk_model.py and the yield dip in
yield_forecast_lstm.py have something real to detect) and realistic
missing data (ECOSTRESS especially, matching its irregular ISS-based
sampling noted in ingest_ecostress.py).
"""

import csv
import math
import random
import uuid
from datetime import date, timedelta
from pathlib import Path

random.seed(42)

OUTPUT_DIR = Path("ml-models/data/raw")
N_FIELDS = 8
YEARS = 5
STEP_DAYS = 16
DROUGHT_FIELD_INDEX = 2  # this field gets a sustained drought event injected


def seasonal(day_of_year: int, amplitude: float, offset: float, phase_shift: int = 0) -> float:
    return offset + amplitude * math.sin(2 * math.pi * (day_of_year - phase_shift) / 365)


def generate_field_series(field_id: str, is_drought_field: bool, start: date, steps: int) -> list[dict]:
    rows = []
    grace_trend = 0.0

    for i in range(steps):
        current_date = start + timedelta(days=i * STEP_DAYS)
        doy = current_date.timetuple().tm_yday
        in_drought_window = is_drought_field and (400 <= i * STEP_DAYS <= 650)  # ~8 month drought, one season

        # SMAP root-zone soil moisture (m3/m3), seasonal wet/dry cycle
        smap = seasonal(doy, amplitude=0.08, offset=0.28, phase_shift=90) + random.gauss(0, 0.01)
        if in_drought_window:
            smap *= 0.55  # sustained ~45% drop

        # MODIS NDVI, lags soil moisture by ~2-3 weeks, dips harder/longer during drought
        modis = seasonal(doy, amplitude=0.25, offset=0.45, phase_shift=110) + random.gauss(0, 0.02)
        if in_drought_window:
            modis *= 0.6
        modis = max(0.05, min(0.9, modis))

        # GPM monthly rainfall accumulation (mm)
        gpm = max(0, seasonal(doy, amplitude=90, offset=110, phase_shift=100) + random.gauss(0, 10))
        if in_drought_window:
            gpm *= 0.35

        # ECOSTRESS ESI (0-1, lower = more plant water stress); irregular coverage, ~15% missing
        ecostress = None
        if random.random() > 0.15:
            ecostress = seasonal(doy, amplitude=0.15, offset=0.55, phase_shift=90) + random.gauss(0, 0.03)
            if in_drought_window:
                ecostress *= 0.6
            ecostress = max(0.05, min(0.95, ecostress))

        # GRACE-FO groundwater anomaly (cm equivalent water thickness) — slow trend, not seasonal
        if is_drought_field:
            grace_trend -= 0.15 if in_drought_window else 0.02
        else:
            grace_trend += random.gauss(0, 0.05)
        grace = grace_trend + random.gauss(0, 0.5)

        for dataset_name, value in [
            ("SMAP", smap), ("MODIS", modis), ("GPM", gpm),
            ("ECOSTRESS", ecostress), ("GRACE-FO", grace),
        ]:
            if value is not None:
                rows.append({"field_id": field_id, "date": current_date.isoformat(),
                             "dataset": dataset_name, "value": round(value, 4)})

    return rows


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    start = date.today() - timedelta(days=YEARS * 365)
    steps = (YEARS * 365) // STEP_DAYS

    for idx in range(N_FIELDS):
        field_id = str(uuid.uuid4())
        is_drought_field = (idx == DROUGHT_FIELD_INDEX)
        rows = generate_field_series(field_id, is_drought_field, start, steps)

        output_path = OUTPUT_DIR / f"field_{field_id}_history.csv"
        with open(output_path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["field_id", "date", "dataset", "value"])
            writer.writeheader()
            writer.writerows(rows)

        tag = " (drought field)" if is_drought_field else ""
        print(f"wrote {output_path} — {len(rows)} rows{tag}")


if __name__ == "__main__":
    main()