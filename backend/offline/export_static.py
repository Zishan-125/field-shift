"""
FIELD SHIFT — export the offline API as static JSON for a server-less site

Writes every response the frontend needs to frontend-web/public/data/, so the
built site runs with no backend (and the PWA service worker can precache it):

    health.json, crops.json
    field.json, environment.json, soil.json        the original test plot
    demo-fields.json                               six demo fields, timeline, top picks
    district-context.json                          64 districts' Aman area 2024/2023 (national context)
    climate-shift/<upazila>.json                   one per upazila (+ default.json)
    recommendations/<field_id>.json                default-priority response + pattern_order
    manifest.json                                  what was exported, when, from which commit

Pattern scores depend on the farmer's priorities only through a weighted sum
of the per-pattern component scores (food, water, soil, climate, diversity),
which are in the export. The frontend re-ranks in TypeScript
(src/services/staticRanking.ts). `pattern_order` is the order the server
iterates patterns in, which decides ties exactly as the API does.

Also writes src/services/__fixtures__/api-rankings.json: the API's ranking for
three fields x three priority settings, checked by the frontend test
(npm test) against the static re-ranking.

Run (after any change to field_shift.db):
    python backend/offline/export_static.py
"""

from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend" / "offline"))

OUT = ROOT / "frontend-web" / "public" / "data"
FIXTURE = ROOT / "frontend-web" / "src" / "services" / "__fixtures__" / "api-rankings.json"

PRIORITY_SETTINGS = {
    "default": None,
    "food_first": {"food_production": 0.7, "water_productivity": 0.1, "soil_health": 0.05,
                   "climate_resilience": 0.1, "crop_diversity": 0.05},
    "climate_first": {"food_production": 0.1, "water_productivity": 0.1, "soil_health": 0.1,
                      "climate_resilience": 0.6, "crop_diversity": 0.1},
}
FIXTURE_FIELDS = ["feni_sonagazi_01", "feni_fulgazi_01", "feni_feni_sadar_01"]


def slug(text: str) -> str:
    return text.lower().replace(" ", "_")


def write(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def main() -> None:
    from fastapi.testclient import TestClient
    import server

    client = TestClient(server.app)

    def get(path: str, **params):
        response = client.get(path, params=params)
        response.raise_for_status()
        return response.json()

    def post(path: str, body: dict):
        response = client.post(path, json=body)
        response.raise_for_status()
        return response.json()

    pattern_order = [row["pattern_id"] for row in server.load_patterns_or_404()]
    files = []

    for name, path in (("health", "/api/offline/health"), ("crops", "/api/offline/crops"),
                       ("field", f"/api/offline/fields/{server.FIELD_ID}"),
                       ("environment", f"/api/offline/fields/{server.FIELD_ID}/environment"),
                       ("soil", f"/api/offline/fields/{server.FIELD_ID}/soil"),
                       ("demo-fields", "/api/offline/demo-fields"),
                       ("district-context", "/api/offline/district-context")):
        write(OUT / f"{name}.json", get(path))
        files.append(f"{name}.json")

    default_climate = get("/api/offline/climate-shift")
    write(OUT / "climate-shift" / "default.json", default_climate)
    files.append("climate-shift/default.json")
    for upazila in default_climate["available_upazilas"]:
        write(OUT / "climate-shift" / f"{slug(upazila)}.json", get("/api/offline/climate-shift", upazila=upazila))
        files.append(f"climate-shift/{slug(upazila)}.json")

    demo_ids = [f["field_id"] for f in get("/api/offline/demo-fields")["fields"]]
    for field_id in demo_ids + [server.FIELD_ID]:
        response = post(f"/api/offline/fields/{field_id}/pattern-recommendations", {})
        response["pattern_order"] = pattern_order
        write(OUT / "recommendations" / f"{field_id}.json", response)
        files.append(f"recommendations/{field_id}.json")

    fixture = {}
    for field_id in FIXTURE_FIELDS:
        for setting, priorities in PRIORITY_SETTINGS.items():
            body = priorities or {}
            response = post(f"/api/offline/fields/{field_id}/pattern-recommendations", body)
            fixture[f"{field_id}|{setting}"] = {
                "priorities": priorities,
                "ranking": [p["pattern_id"] for p in response["results"]],
                "scores": [p["score"] for p in response["results"]],
                "current_score": response["current"]["score"],
            }
    write(FIXTURE, fixture)

    commit = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True, cwd=ROOT).stdout.strip()
    write(OUT / "manifest.json", {
        "exported_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source_commit": commit,
        "database": "backend/offline/field_shift.db",
        "files": files,
    })
    print(f"[OK] {len(files)} files -> {OUT}; fixture {len(fixture)} rankings -> {FIXTURE}")


if __name__ == "__main__":
    main()
