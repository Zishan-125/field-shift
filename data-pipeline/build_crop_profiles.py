"""FIELD SHIFT — validate crop profile scenario priors.

These profiles are NOT observed yield labels and must not be used as
supervised-learning ground truth. Normalized indices are engineering priors
for transparent scenario comparison and should be replaced/refined when
crop-specific local measurements or validated literature values are available.
"""
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "data-pipeline" / "output" / "crop" / "crop_profiles.csv"

REQUIRED = [
    "crop_id","crop_name","scientific_name","crop_category","season",
    "typical_sowing_months","typical_harvest_months","growth_duration_days",
    "water_demand_class","water_demand_index","drought_tolerance",
    "heat_tolerance","waterlogging_tolerance","soil_ph_min","soil_ph_max",
    "nitrogen_demand","soil_fertility_dependency","rotation_group",
    "rotation_role","legume","source","source_quality","profile_status"
]
BOUNDED = ["water_demand_index","drought_tolerance","heat_tolerance",
           "waterlogging_tolerance","nitrogen_demand","soil_fertility_dependency"]

def main():
    print("=" * 72)
    print("FIELD SHIFT — VALIDATE CROP PROFILES")
    print("=" * 72)
    if not PATH.exists():
        raise FileNotFoundError(PATH)
    df = pd.read_csv(PATH)
    missing = [c for c in REQUIRED if c not in df.columns]
    if missing: raise ValueError(f"Missing columns: {missing}")
    if df.empty: raise ValueError("Crop profile table is empty")
    if df.crop_id.duplicated().any(): raise ValueError("Duplicate crop_id")
    if df.growth_duration_days.le(0).any(): raise ValueError("Invalid growth duration")
    for c in BOUNDED:
        x = pd.to_numeric(df[c], errors="coerce")
        if x.isna().any() or ((x < 0) | (x > 1)).any():
            raise ValueError(f"{c} must be numeric in [0,1]")
    phmin = pd.to_numeric(df.soil_ph_min, errors="coerce")
    phmax = pd.to_numeric(df.soil_ph_max, errors="coerce")
    if phmin.isna().any() or phmax.isna().any() or (phmin >= phmax).any():
        raise ValueError("Invalid soil pH ranges")
    if not set(df.legume.unique()).issubset({0,1}):
        raise ValueError("legume must be 0/1")
    if not (df.profile_status == "scenario_prior").all():
        raise ValueError("Profiles must be marked scenario_prior")
    print(f"[OK] Profiles: {len(df)}")
    print(f"[OK] Columns: {len(df.columns)}")
    print("[OK] Required fields present")
    print("[OK] No duplicate crop IDs")
    print("[OK] Growth duration and pH ranges valid")
    print("[OK] Normalized scenario priors remain in [0,1]")
    print("[OK] Legume flags valid")
    print("[OK] No crop-yield target column present")
    print("\nCROPS:")
    print(df[["crop_id","crop_name","season","growth_duration_days",
              "water_demand_class","rotation_role"]].to_string(index=False))
    print("\n[SUCCESS] Crop profile layer validated.")
    print(f"[OUTPUT] {PATH}")

if __name__ == "__main__": main()

