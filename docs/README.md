# Field Shift docs

Start with the [project README](../README.md) for the validation table and how to run the app.

## Methodology

| Document | What it answers |
|---|---|
| [methodology/climate-shift.md](methodology/climate-shift.md) | Rain (GPM) and temperature (POWER) records, trend tests, why POWER rain was rejected, variability and return periods, the hazard–yield check, CMIP6 projections |
| [methodology/field-risk.md](methodology/field-risk.md) | Hazard frequencies from each demo field's own record, how they enter the ranking, the observed-season feasibility rule, before/after top picks |
| [methodology/phenology.md](methodology/phenology.md) | The rules that label Boro, T. Aman, other Rabi crops and fallow from HLS and Sentinel-1, with thresholds and failure modes |
| [methodology/bbs-aman-area-check.md](methodology/bbs-aman-area-check.md) | Whether Feni's 2024-25 Aman fall is a unit error (units verified across three Yearbooks and a DAE report) |

## Machine learning

| Document | What it answers |
|---|---|
| [ml/crop_classifier.md](ml/crop_classifier.md) | Model card for the LightGBM crop classifier: data, year split, metrics, SHAP, the failed BBS area check, the Sentinel-1 flood-extent check, where it is (and is not) used |

## Data

| Document | What it answers |
|---|---|
| [data-sources.md](data-sources.md) | Every dataset and publication used, with collection IDs, tables and pages |
| [data-gaps.md](data-gaps.md) | What is missing or inconsistent in the data and what the app does about it |
| [demo-script.md](demo-script.md) | A four-minute walk-through for judges |
| [deployment.md](deployment.md) | Deploying the static site (no backend) or with the API |
| [merge-notes.md](merge-notes.md) | Conflicts with the base branch, region by region (merge not performed) |

Older material that is no longer used is listed in [../archive/README.md](../archive/README.md).
