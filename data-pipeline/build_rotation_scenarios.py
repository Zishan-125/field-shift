"""FIELD SHIFT — BUILD ROTATION SCENARIOS

Creates transparent crop-month compatibility indicators and candidate 2/3-crop
rotation scenarios from the validated agricultural feature layer and crop
profiles. This is NOT a crop-yield prediction model and creates no synthetic
yield target.
"""
from pathlib import Path
from itertools import permutations
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
AG_PATH = ROOT / "data-pipeline/output/features/agricultural_features_2019_2024.csv"
CROP_PATH = ROOT / "data-pipeline/output/crop/crop_profiles.csv"
OUT = ROOT / "data-pipeline/output/scenarios"
OUT.mkdir(parents=True, exist_ok=True)
COMPAT_PATH = OUT / "crop_month_compatibility.csv"
SCENARIO_PATH = OUT / "rotation_scenarios.csv"

REQ_AG = ["field_id","year","month","month_number","ag_rainfall_mm","ag_soil_moisture",
"ag_temperature_c","ag_water_stress_proxy","ag_heat_stress_proxy","soil_topsoil_ph",
"soil_topsoil_nitrogen","soil_topsoil_organic_carbon"]
REQ_CROP = ["crop_id","crop_name","season","growth_duration_days","water_demand_index",
"drought_tolerance","heat_tolerance","waterlogging_tolerance","soil_ph_min","soil_ph_max",
"nitrogen_demand","soil_fertility_dependency","rotation_group","rotation_role","legume"]
SEASON_MONTHS={"kharif":{6,7,8,9,10,11},"rabi":{10,11,12,1,2,3,4},
               "rabi_kharif":{2,3,4,5,10,11,12}}

def clamp(x):
    if pd.isna(x): return np.nan
    return float(np.clip(x,0,1))

def ph_score(ph, lo, hi):
    if pd.isna(ph): return np.nan
    if lo <= ph <= hi: return 1.0
    return clamp(1 - ((lo-ph) if ph<lo else (ph-hi))/1.5)

def water_score(rain, demand):
    if pd.isna(rain): return np.nan
    reference=70+180*float(demand)
    return clamp(float(rain)/max(reference,1))

def resilience(proxy, tolerance):
    if pd.isna(proxy): return np.nan
    return clamp(.5*(1-float(proxy))+.5*float(tolerance))

def waterlogging_score(rain, tolerance):
    if pd.isna(rain): return np.nan
    exposure=clamp((float(rain)-250)/600)
    return clamp(1-exposure*(1-float(tolerance)))

def fertility_score(row,crop):
    vals=[]
    n=row.get("soil_topsoil_nitrogen",np.nan); soc=row.get("soil_topsoil_organic_carbon",np.nan)
    if not pd.isna(n): vals.append(1-float(crop.nitrogen_demand)*(1-clamp(float(n)/30)))
    if not pd.isna(soc): vals.append(1-float(crop.soil_fertility_dependency)*(1-clamp(float(soc)/30)))
    return float(np.mean(vals)) if vals else np.nan

def main():
    print("="*72); print("FIELD SHIFT — BUILD ROTATION SCENARIOS"); print("="*72)
    ag=pd.read_csv(AG_PATH); crops=pd.read_csv(CROP_PATH)
    print(f"[INPUT] Agricultural features: {ag.shape}")
    print(f"[INPUT] Crop profiles: {crops.shape}")
    ma=[c for c in REQ_AG if c not in ag.columns]; mc=[c for c in REQ_CROP if c not in crops.columns]
    if ma: raise ValueError(f"Missing agricultural columns: {ma}")
    if mc: raise ValueError(f"Missing crop columns: {mc}")
    if ag.field_id.nunique()!=1: raise ValueError("Expected exactly one field.")
    if ag[["year","month_number"]].duplicated().any(): raise ValueError("Duplicate field-month records.")
    if crops.crop_id.duplicated().any(): raise ValueError("Duplicate crop IDs.")
    print("[OK] Input schemas validated.")

    rows=[]
    for _,r in ag.iterrows():
        for _,c in crops.iterrows():
            season_months=SEASON_MONTHS.get(str(c.season),set(range(1,13)))
            ph=ph_score(r.soil_topsoil_ph,float(c.soil_ph_min),float(c.soil_ph_max))
            ws=water_score(r.ag_rainfall_mm,float(c.water_demand_index))
            dr=resilience(r.ag_water_stress_proxy,float(c.drought_tolerance))
            hr=resilience(r.ag_heat_stress_proxy,float(c.heat_tolerance))
            wr=waterlogging_score(r.ag_rainfall_mm,float(c.waterlogging_tolerance))
            sf=fertility_score(r,c)
            vals=[x for x in [ph,ws,dr,hr,wr,sf] if not pd.isna(x)]
            comp=float(np.mean(vals)) if vals else np.nan
            rows.append({"field_id":r.field_id,"year":int(r.year),"month":r.month,"month_number":int(r.month_number),
                "crop_id":c.crop_id,"crop_name":c.crop_name,"season":c.season,"rotation_group":c.rotation_group,
                "rotation_role":c.rotation_role,"legume":int(c.legume),"in_season_window":int(int(r.month_number) in season_months),
                "soil_ph_compatibility":ph,"water_availability_score":ws,"drought_resilience_score":dr,
                "heat_resilience_score":hr,"waterlogging_resilience_score":wr,"soil_fertility_compatibility":sf,
                "crop_month_compatibility_score":comp})
    compat=pd.DataFrame(rows)
    compat.to_csv(COMPAT_PATH,index=False)

    candidates=[]
    for a,b in permutations(crops.itertuples(index=False),2):
        candidates.append({"rotation_id":f"rot2_{a.crop_id}_{b.crop_id}","rotation_length":2,
          "crop_1_id":a.crop_id,"crop_1_name":a.crop_name,"crop_2_id":b.crop_id,"crop_2_name":b.crop_name,
          "crop_3_id":"","crop_3_name":"","rotation_group_diversity":float(a.rotation_group!=b.rotation_group),
          "legume_in_rotation":int(bool(a.legume or b.legume))})
    for a in crops.itertuples(index=False):
      for b in crops.itertuples(index=False):
       for c in crops.itertuples(index=False):
        if len({a.crop_id,b.crop_id,c.crop_id})<3 or not (a.legume or b.legume or c.legume): continue
        candidates.append({"rotation_id":f"rot3_{a.crop_id}_{b.crop_id}_{c.crop_id}","rotation_length":3,
          "crop_1_id":a.crop_id,"crop_1_name":a.crop_name,"crop_2_id":b.crop_id,"crop_2_name":b.crop_name,
          "crop_3_id":c.crop_id,"crop_3_name":c.crop_name,
          "rotation_group_diversity":len({a.rotation_group,b.rotation_group,c.rotation_group})/3,
          "legume_in_rotation":1})
    scen=pd.DataFrame(candidates)
    crop_scores=compat[compat.in_season_window==1].groupby("crop_id").crop_month_compatibility_score.mean()
    for i in (1,2,3): scen[f"crop_{i}_mean_compatibility"]=scen[f"crop_{i}_id"].map(crop_scores)
    scen["rotation_environmental_compatibility"]=scen[[f"crop_{i}_mean_compatibility" for i in (1,2,3)]].mean(axis=1,skipna=True)
    scen["rotation_diversity_score"]=scen.rotation_group_diversity.clip(0,1)
    scen["legume_indicator"]=scen.legume_in_rotation.astype(float)
    scen["transparent_rotation_score"]=scen[["rotation_environmental_compatibility","rotation_diversity_score","legume_indicator"]].mean(axis=1,skipna=True)
    scen["score_type"]="scenario_indicator_not_yield_prediction"
    scen["synthetic_yield_target"]=0
    scen.to_csv(SCENARIO_PATH,index=False)
    print(f"[OK] Crop-month compatibility rows: {len(compat)}")
    print(f"[OK] Rotation scenarios: {len(scen)}")
    print(f"[OK] 2-crop scenarios: {(scen.rotation_length==2).sum()}")
    print(f"[OK] 3-crop scenarios: {(scen.rotation_length==3).sum()}")
    print("[OK] No crop-yield prediction or synthetic yield target generated.")
    print(f"[OUTPUT] {COMPAT_PATH}"); print(f"[OUTPUT] {SCENARIO_PATH}")
    print("\nSAMPLE SCENARIOS:")
    cols=["rotation_id","crop_1_name","crop_2_name","crop_3_name","legume_in_rotation","rotation_environmental_compatibility","transparent_rotation_score"]
    print(scen.sort_values("transparent_rotation_score",ascending=False)[cols].head(10).to_string(index=False))
    print("="*72); print("[SUCCESS] Rotation scenario layer created."); print("="*72)
if __name__=="__main__": main()

