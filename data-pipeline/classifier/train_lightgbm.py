"""
FIELD SHIFT — LightGBM crop classifier, year split, BBS area check

Inputs (committed):
    data/processed/classifier_dekads.csv            dekad composites at 1,200 points
    data/processed/classifier_phenology_labels.csv  weak labels (phenology_labels.py)
    reference/classifier_points.csv                 point -> district
    reference/bbs_district_rice_area.csv            BBS Total Aman / Total Boro
    reference/bbs_district_land_use.csv             BBS net cropped area

Split by season year (no random split):
    train  <= 2022     validate  2023     test  2024
2025 is only predicted (for the BBS Boro 2024-25 comparison and the demo).

Classes: Boro, Rabi_nonrice, Fallow (Rabi season); T_Aman, Fallow
(Kharif-2). One model with a season flag; classes that cannot occur in a
season are given probability 0 and the rest renormalised.

BBS check (independent of the weak labels):
    * year-on-year ratios per district: Aman 2024 / 2023, Boro 2025 / 2024
    * between-district ratio Boro / Aman in the same BBS year
    * hectares = share of points x BBS net cropped area (shown, with the
      caveat that BBS Aman exceeds BBS net cropped area in Feni and Noakhali)
    Aman-collapse check, fixed before looking at results: PASS if the
    predicted Feni Aman 2024/2023 ratio is below 0.70 AND it is the lowest of
    the three districts (BBS: Feni 0.40, Noakhali 0.83, Cumilla 0.87).
    BBS units were verified (docs/methodology/bbs-aman-area-check.md); the
    Feni 2024-25 figure is plausible but not confirmed, so this check is
    reported as agreement with BBS, not as proof of accuracy.

Outputs:
    data-pipeline/derived/classifier_metrics.csv        per-class P/R/F1, val and test
    data-pipeline/derived/classifier_confusion.csv      confusion matrices
    data-pipeline/derived/classifier_shap.csv           mean |SHAP| by band and by dekad
    data-pipeline/derived/classifier_bbs_check.csv      satellite vs BBS
    data-pipeline/derived/classifier_predictions.csv    every point-season 2016-2025
    data-pipeline/output/classifier/lightgbm.txt        model (git-ignored)

Run:
    python data-pipeline/classifier/train_lightgbm.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.metrics import confusion_matrix, f1_score, precision_recall_fscore_support

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "data-pipeline" / "classifier"))

from features import build_samples, feature_columns  # noqa: E402
from phenology_labels import label_all  # noqa: E402

PROCESSED = ROOT / "data-pipeline" / "data" / "processed"
REFERENCE = ROOT / "data-pipeline" / "reference"
DERIVED = ROOT / "data-pipeline" / "derived"
MODEL_DIR = ROOT / "data-pipeline" / "output" / "classifier"

CLASSES = ["Boro", "Rabi_nonrice", "Fallow", "T_Aman"]
SEASON_CLASSES = {"rabi": {"Boro", "Rabi_nonrice", "Fallow"}, "kharif2": {"T_Aman", "Fallow"}}
TRAIN_LAST, VALIDATE, TEST = 2022, 2023, 2024
COLLAPSE_MAX_RATIO = 0.70
SEED = 2026

PARAMS = {
    "objective": "multiclass", "num_class": len(CLASSES), "learning_rate": 0.05,
    "num_leaves": 31, "min_data_in_leaf": 20, "feature_fraction": 0.5, "bagging_fraction": 0.8,
    "bagging_freq": 1, "lambda_l2": 1.0, "seed": SEED, "verbose": -1,
}


# ---------------------------------------------------------------------
# DATA
# ---------------------------------------------------------------------

def load_samples() -> pd.DataFrame:
    dekads = pd.read_csv(PROCESSED / "classifier_dekads.csv")
    labels_path = PROCESSED / "classifier_phenology_labels.csv"
    labels = pd.read_csv(labels_path) if labels_path.exists() else label_all(dekads)
    if not labels_path.exists():
        labels.to_csv(labels_path, index=False)

    samples = build_samples(dekads)
    samples = samples.merge(labels[["point_id", "season", "year", "label"]], on=["point_id", "season", "year"], how="left")
    points = pd.read_csv(REFERENCE / "classifier_points.csv")[["point_id", "district"]]
    return samples.merge(points, on="point_id", how="left")


def season_mask(frame: pd.DataFrame) -> np.ndarray:
    return np.array([[c in SEASON_CLASSES[s] for c in CLASSES] for s in frame["season"]], dtype=float)


def predict(model: lgb.Booster, frame: pd.DataFrame, columns: list[str]) -> np.ndarray:
    proba = model.predict(frame[columns]) * season_mask(frame)
    return proba / proba.sum(axis=1, keepdims=True)


# ---------------------------------------------------------------------
# TRAIN AND EVALUATE
# ---------------------------------------------------------------------

def class_weights(labels: pd.Series) -> pd.Series:
    counts = labels.value_counts()
    return labels.map(len(labels) / (len(counts) * counts))


def metrics(frame: pd.DataFrame, proba: np.ndarray, split: str) -> tuple[list[dict], pd.DataFrame]:
    truth = frame["label"].to_numpy()
    pred = np.array(CLASSES)[proba.argmax(axis=1)]
    present = [c for c in CLASSES if c in set(truth) | set(pred)]
    p, r, f, n = precision_recall_fscore_support(truth, pred, labels=present, zero_division=0)
    rows = [{"split": split, "class": c, "precision": round(p[i], 3), "recall": round(r[i], 3),
             "f1": round(f[i], 3), "support": int(n[i])} for i, c in enumerate(present)]
    rows.append({"split": split, "class": "macro", "f1": round(f1_score(truth, pred, labels=present, average="macro"), 3),
                 "support": len(truth)})
    rows.append({"split": split, "class": "accuracy", "f1": round(float((truth == pred).mean()), 3), "support": len(truth)})
    cm = pd.DataFrame(confusion_matrix(truth, pred, labels=present), index=[f"true_{c}" for c in present],
                      columns=[f"pred_{c}" for c in present])
    cm.insert(0, "split", split)
    return rows, cm


def shap_summary(model: lgb.Booster, frame: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    import shap

    sample = frame[columns].sample(min(2000, len(frame)), random_state=SEED)
    values = shap.TreeExplainer(model).shap_values(sample)
    values = np.stack(values, axis=-1) if isinstance(values, list) else values   # (n, features, classes)
    importance = pd.Series(np.abs(values).mean(axis=(0, 2)), index=columns)

    rows = []
    for column, value in importance.items():
        band, _, dekad = column.rpartition("_k")
        rows.append({"feature": column, "band": band if band else column,
                     "dekad": int(dekad) if dekad.isdigit() else None, "mean_abs_shap": value})
    return pd.DataFrame(rows).sort_values("mean_abs_shap", ascending=False)


# ---------------------------------------------------------------------
# BBS CHECK
# ---------------------------------------------------------------------

def bbs_check(predictions: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    bbs = pd.read_csv(REFERENCE / "bbs_district_rice_area.csv")
    land = pd.read_csv(REFERENCE / "bbs_district_land_use.csv").set_index("district")["net_cropped_ha"]
    crop_of = {"total_aman": ("kharif2", "T_Aman", "label_rule"), "total_boro": ("rabi", "Boro", "label_rule")}
    rows = []

    for r in bbs.itertuples():
        season, cls, _ = crop_of[r.crop]
        p = predictions[(predictions["district"] == r.district) & (predictions["season"] == season)
                        & (predictions["year"] == r.season_year)]
        if p.empty:
            continue
        model_share = float((p["predicted"] == cls).mean())
        rule_share = float((p["label"] == cls).mean())                # rules only; unlabelled counts as "not"
        rows.append({
            "district": r.district, "crop": r.crop, "bbs_year": r.bbs_year, "season_year": r.season_year,
            "n_points": len(p), "model_share": round(model_share, 3), "rules_share": round(rule_share, 3),
            "model_mean_probability": round(float(p[f"p_{cls}"].mean()), 3),
            "bbs_area_ha": r.area_ha, "bbs_share_of_net_cropped": round(r.area_ha / land[r.district], 3),
            "model_area_ha_net_cropped_basis": round(model_share * land[r.district]),
        })

    table = pd.DataFrame(rows)

    def ratio(frame: pd.DataFrame, crop: str, y1: int, y0: int, column: str) -> dict:
        out = {}
        for district, g in frame[frame["crop"] == crop].groupby("district"):
            g = g.set_index("season_year")
            if y1 in g.index and y0 in g.index and g.loc[y0, column]:
                out[district] = round(float(g.loc[y1, column] / g.loc[y0, column]), 3)
        return out

    summary = {
        "aman_2024_over_2023": {
            "bbs": ratio(table, "total_aman", 2024, 2023, "bbs_area_ha"),
            "model": ratio(table, "total_aman", 2024, 2023, "model_share"),
            "rules": ratio(table, "total_aman", 2024, 2023, "rules_share"),
        },
        "boro_2025_over_2024": {
            "bbs": ratio(table, "total_boro", 2025, 2024, "bbs_area_ha"),
            "model": ratio(table, "total_boro", 2025, 2024, "model_share"),
            "rules": ratio(table, "total_boro", 2025, 2024, "rules_share"),
        },
    }

    boro_over_aman = {}
    for district in table["district"].unique():
        t = table[table["district"] == district].set_index(["crop", "season_year"])
        try:   # BBS 2023-24: Aman Kharif-2 2023, Boro Rabi 2024
            boro_over_aman[district] = {
                "bbs": round(float(t.loc[("total_boro", 2024), "bbs_area_ha"] / t.loc[("total_aman", 2023), "bbs_area_ha"]), 3),
                "model": round(float(t.loc[("total_boro", 2024), "model_share"] / t.loc[("total_aman", 2023), "model_share"]), 3),
            }
        except (KeyError, ZeroDivisionError):
            continue
    summary["boro_over_aman_2023_24"] = boro_over_aman

    model_ratio = summary["aman_2024_over_2023"]["model"]
    feni = model_ratio.get("Feni")
    summary["aman_collapse_check"] = {
        "rule": f"Feni model Aman 2024/2023 < {COLLAPSE_MAX_RATIO} and lowest of the three districts",
        "feni_ratio": feni,
        "passed": bool(feni is not None and feni < COLLAPSE_MAX_RATIO and feni == min(model_ratio.values())),
    }
    return table, summary


# ---------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------

def main() -> None:
    samples = load_samples()
    columns = feature_columns(samples)
    labelled = samples[samples["label"].notna()]

    train = labelled[labelled["year"] <= TRAIN_LAST]
    valid = labelled[labelled["year"] == VALIDATE]
    test = labelled[labelled["year"] == TEST]
    print(f"samples {len(samples)}, labelled {len(labelled)}: train {len(train)}, validate {len(valid)}, test {len(test)}")
    print(labelled.groupby(["year", "label"]).size().unstack(fill_value=0).to_string())

    encode = {c: i for i, c in enumerate(CLASSES)}
    dtrain = lgb.Dataset(train[columns], train["label"].map(encode), weight=class_weights(train["label"]))
    dvalid = lgb.Dataset(valid[columns], valid["label"].map(encode), weight=class_weights(valid["label"]), reference=dtrain)
    model = lgb.train(PARAMS, dtrain, num_boost_round=2000, valid_sets=[dvalid],
                      callbacks=[lgb.early_stopping(50, verbose=False)])
    print(f"best iteration {model.best_iteration}")

    metric_rows, matrices = [], []
    for name, frame in (("validate_2023", valid), ("test_2024", test)):
        rows, cm = metrics(frame, predict(model, frame, columns), name)
        metric_rows += rows
        matrices.append(cm)

    proba = predict(model, samples, columns)
    predictions = samples[["point_id", "district", "season", "year", "label", "n_optical_dekads", "n_radar_dekads"]].copy()
    for i, c in enumerate(CLASSES):
        predictions[f"p_{c}"] = proba[:, i].round(4)
    predictions["predicted"] = np.array(CLASSES)[proba.argmax(axis=1)]

    table, summary = bbs_check(predictions)

    DERIVED.mkdir(parents=True, exist_ok=True)
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    model.save_model(str(MODEL_DIR / "lightgbm.txt"))
    pd.DataFrame(metric_rows).to_csv(DERIVED / "classifier_metrics.csv", index=False)
    pd.concat(matrices).to_csv(DERIVED / "classifier_confusion.csv")
    shap_summary(model, test if len(test) else valid, columns).to_csv(DERIVED / "classifier_shap.csv", index=False)
    table.to_csv(DERIVED / "classifier_bbs_check.csv", index=False)
    (DERIVED / "classifier_bbs_summary.json").write_text(json.dumps(summary, indent=1), encoding="utf-8")
    predictions.to_csv(DERIVED / "classifier_predictions.csv", index=False)

    print(pd.DataFrame(metric_rows).to_string(index=False))
    print(pd.concat(matrices).to_string())
    print(table.to_string(index=False))
    print(json.dumps(summary, indent=1))


if __name__ == "__main__":
    main()
