"""
The last file in the original architecture tree, and worth being
precise about what it predicts and why, given the global-coverage
decision you just made.

There is no free, global, per-field yield ground truth dataset —
USDM and CDL were the closest thing, and you've correctly ruled those
out as US-only. So rather than bootstrapping against a regional
dataset that would quietly narrow "works anywhere NASA has coverage"
back down to "works in the US," this model predicts a
**physically-grounded proxy for yield that needs no labeled dataset
at all**: the cumulative NDVI over a field's next growing-season
window.

This isn't an improvised stand-in — integrated/cumulative NDVI over
the growing season is a well-established remote-sensing proxy for
biomass and yield in the agricultural literature, precisely because
it works the same way everywhere sunlight and chlorophyll do: a
smallholder plot in Bangladesh and a commercial field in Iowa are
governed by the same physics, even though a US-specific labeled
dataset would only cover one of them. Training is fully
self-supervised: for any field's historical NASA time series (from
gee_field_clip.py), the model learns to predict the NDVI trajectory
that already happened, using only the window before it — no external
labels, no regional bias, works on every field you've ever pulled
data for.

Be explicit about this to judges: this forecasts a *yield proxy*, not
calibrated bushels-per-acre. If a specific deployment region later
gets a real local yield dataset (a cooperative's harvest records, an
NGO's field reports), that becomes a fine-tuning step on top of this
same architecture — not a rebuild.

Run as: python ml-models/yield_forecast_lstm.py
Input:  ml-models/data/raw/field_*_history.csv
Output: ml-models/saved_models/yield_forecast_lstm.pt
"""

import json
import sys
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from sklearn.model_selection import GroupShuffleSplit
from sklearn.preprocessing import StandardScaler
from torch.utils.data import DataLoader, Dataset

sys.path.insert(0, str(Path(__file__).parent))  # allow `import stress_risk_model` as a sibling script
from stress_risk_model import FEATURE_COLUMNS, RAW_DATA_DIR, load_long_format, pivot_to_wide  # noqa: E402

SAVED_MODEL_DIR = Path("ml-models/saved_models")

INPUT_STEPS = 6    # ~6 * 16-day windows ≈ 3 months of history as input
TARGET_STEPS = 4   # ~4 * 16-day windows ≈ next growing-season stretch to forecast
NDVI_COLUMN = "MODIS"  # the column this file treats as the yield-proxy signal

HIDDEN_SIZE = 32
NUM_LAYERS = 2
EPOCHS = 40
BATCH_SIZE = 16
LEARNING_RATE = 1e-3


def _build_sequences(wide) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Slides an (INPUT_STEPS -> TARGET_STEPS) window over each field's
    own time series independently — sequences never cross a field
    boundary, so the model never learns "field A's history predicts
    field B's future," which would be meaningless.

    Returns:
        X: (n_samples, INPUT_STEPS, n_features)
        y: (n_samples,) — the yield proxy target (summed future NDVI)
        groups: (n_samples,) — field_id per sample, for a leakage-safe split
    """
    X, y, groups = [], [], []

    for field_id, field_df in wide.groupby("field_id"):
        field_df = field_df.sort_values("date")
        features = field_df[FEATURE_COLUMNS].to_numpy(dtype=np.float32)
        ndvi = field_df[NDVI_COLUMN].to_numpy(dtype=np.float32)

        # forward/back-fill short gaps rather than dropping rows —
        # dropping would break the fixed-length sliding window
        features = _fill_short_gaps(features)
        ndvi = _fill_short_gaps(ndvi.reshape(-1, 1)).flatten()

        total_steps = INPUT_STEPS + TARGET_STEPS
        for start in range(len(field_df) - total_steps + 1):
            input_window = features[start: start + INPUT_STEPS]
            target_window = ndvi[start + INPUT_STEPS: start + total_steps]
            if np.isnan(input_window).any() or np.isnan(target_window).any():
                continue  # a gap too long to fill safely — skip this window, don't fabricate data
            X.append(input_window)
            y.append(target_window.sum())  # cumulative NDVI = the yield proxy
            groups.append(field_id)

    return np.array(X), np.array(y), np.array(groups)


def _fill_short_gaps(arr: np.ndarray, max_gap: int = 2) -> np.ndarray:
    """Linear-ish forward/back fill for gaps of at most `max_gap` steps
    (a missed overpass or two); longer gaps are left as NaN and that
    window gets skipped in _build_sequences rather than guessed at."""
    filled = arr.copy()
    for col in range(filled.shape[1]):
        series = filled[:, col]
        nan_idx = np.where(np.isnan(series))[0]
        for i in nan_idx:
            lo = max(0, i - max_gap)
            hi = min(len(series), i + max_gap + 1)
            neighbors = series[lo:hi]
            valid = neighbors[~np.isnan(neighbors)]
            if len(valid) > 0:
                series[i] = valid.mean()
    return filled


class FieldSequenceDataset(Dataset):
    def __init__(self, X: np.ndarray, y: np.ndarray):
        self.X = torch.tensor(X, dtype=torch.float32)
        self.y = torch.tensor(y, dtype=torch.float32)

    def __len__(self) -> int:
        return len(self.X)

    def __getitem__(self, idx: int):
        return self.X[idx], self.y[idx]


class YieldProxyLSTM(nn.Module):
    """A small LSTM: not because the problem needs a huge model, but
    because with realistically few fields in a hackathon dataset, a
    large model would overfit long before it learned anything general
    about how these five signals evolve together."""

    def __init__(self, n_features: int, hidden_size: int = HIDDEN_SIZE, num_layers: int = NUM_LAYERS):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=n_features,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=0.1 if num_layers > 1 else 0.0,
        )
        self.head = nn.Linear(hidden_size, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        _, (hidden, _) = self.lstm(x)
        last_layer_hidden = hidden[-1]  # (batch, hidden_size) — the sequence's final learned state
        return self.head(last_layer_hidden).squeeze(-1)


def train(X: np.ndarray, y: np.ndarray, groups: np.ndarray) -> tuple[YieldProxyLSTM, StandardScaler, StandardScaler]:
    # Split by field, same reasoning as every other model in this repo:
    # random row-level splitting would let the model see other windows
    # from the same field's future during "held-out" evaluation.
    splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
    train_idx, val_idx = next(splitter.split(X, y, groups=groups))

    # LSTMs are sensitive to input scale in a way tree models (XGBoost,
    # used elsewhere in ml-models/) are not — unscaled soil-moisture and
    # rainfall units on very different ranges would make training
    # unstable. Fit the scaler on TRAIN ONLY to avoid leaking
    # validation-set statistics into training.
    n_features = X.shape[-1]
    feature_scaler = StandardScaler().fit(X[train_idx].reshape(-1, n_features))
    target_scaler = StandardScaler().fit(y[train_idx].reshape(-1, 1))

    def _scale(X_split, y_split):
        X_scaled = feature_scaler.transform(X_split.reshape(-1, n_features)).reshape(X_split.shape)
        y_scaled = target_scaler.transform(y_split.reshape(-1, 1)).flatten()
        return X_scaled, y_scaled

    X_train, y_train = _scale(X[train_idx], y[train_idx])
    X_val, y_val = _scale(X[val_idx], y[val_idx])

    train_loader = DataLoader(FieldSequenceDataset(X_train, y_train), batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(FieldSequenceDataset(X_val, y_val), batch_size=BATCH_SIZE)

    model = YieldProxyLSTM(n_features=n_features)
    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)
    loss_fn = nn.MSELoss()

    best_val_loss = float("inf")
    best_state = None

    for epoch in range(1, EPOCHS + 1):
        model.train()
        for batch_X, batch_y in train_loader:
            optimizer.zero_grad()
            predictions = model(batch_X)
            loss = loss_fn(predictions, batch_y)
            loss.backward()
            optimizer.step()

        model.eval()
        val_losses = []
        with torch.no_grad():
            for batch_X, batch_y in val_loader:
                val_losses.append(loss_fn(model(batch_X), batch_y).item())
        val_loss = sum(val_losses) / len(val_losses) if val_losses else float("inf")

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_state = {k: v.clone() for k, v in model.state_dict().items()}

        if epoch % 5 == 0 or epoch == 1:
            print(f"epoch {epoch:3d}/{EPOCHS} — val MSE (scaled): {val_loss:.4f}")

    # Restore the best-validation-epoch weights rather than whatever
    # the model happened to end training on — cheap, effective
    # protection against overfitting in the final epochs.
    model.load_state_dict(best_state)
    print(f"\nBest validation MSE (scaled target): {best_val_loss:.4f}")

    return model, feature_scaler, target_scaler


def main() -> None:
    long_df = load_long_format(RAW_DATA_DIR)
    wide = pivot_to_wide(long_df)

    X, y, groups = _build_sequences(wide)
    if len(X) < 20:
        raise RuntimeError(
            f"Only {len(X)} usable sequences found — need at least "
            f"{INPUT_STEPS + TARGET_STEPS} consecutive, mostly-complete "
            f"time steps per field. Export more history with "
            f"gee_field_clip.py --years or add more fields before training."
        )
    print(f"Built {len(X)} training sequences across {len(set(groups))} field(s).")

    model, feature_scaler, target_scaler = train(X, y, groups)

    SAVED_MODEL_DIR.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), SAVED_MODEL_DIR / "yield_forecast_lstm.pt")
    import joblib
    joblib.dump(feature_scaler, SAVED_MODEL_DIR / "yield_forecast_feature_scaler.joblib")
    joblib.dump(target_scaler, SAVED_MODEL_DIR / "yield_forecast_target_scaler.joblib")
    with open(SAVED_MODEL_DIR / "yield_forecast_config.json", "w") as f:
        json.dump({
            "feature_columns": FEATURE_COLUMNS,
            "input_steps": INPUT_STEPS,
            "target_steps": TARGET_STEPS,
            "target_definition": f"sum of {NDVI_COLUMN} (NDVI) over the next {TARGET_STEPS} steps — a yield proxy, not calibrated yield",
            "hidden_size": HIDDEN_SIZE,
            "num_layers": NUM_LAYERS,
        }, f, indent=2)

    print(f"\nSaved model, scalers, and config to {SAVED_MODEL_DIR}/")
    print(
        "\nThis predicts a physically-grounded yield PROXY (cumulative "
        "future NDVI), not calibrated yield in tons/hectare — say this "
        "explicitly in the demo. If a region-specific yield dataset "
        "becomes available later, fine-tune this same architecture's "
        "head on that data rather than rebuilding it."
    )


if __name__ == "__main__":
    main()