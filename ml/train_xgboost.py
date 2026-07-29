"""
train_xgboost.py — XGBoost model training for the Hybrid Pricing Engine.

USAGE:
    cd ml/
    python generate_dummy_data.py   # generate data first
    python train_xgboost.py         # then train

OUTPUT:
    ../backend/ml_inference/xgboost_pricing_model.json
    ../backend/ml_inference/model_version.txt
    feature_importance.png  (optional, if matplotlib installed)

DESIGN DECISIONS:
    max_depth=3:      Prevents overfitting on 5000-row synthetic data.
                      Depth 3 = 8 leaf nodes max = learns general patterns, not noise.
    n_estimators=100: 100 trees × depth 3 = good coverage without memorization.
    learning_rate=0.1: Standard starting point; lower = more conservative.
    subsample=0.8:    Trains each tree on 80% of data → reduces variance.
    colsample_bytree=0.8: Uses 80% of features per tree → avoids feature dominance.

EVALUATION METRICS:
    MAE  (Mean Absolute Error): Average ₹ error. Target: < ₹100.
    RMSE (Root Mean Squared Error): Penalizes large errors more. Target: < ₹150.
    R²   (Coefficient of Determination): 1.0 = perfect. Target: > 0.90.

INTERVIEW TALKING POINTS:
    - "We use 80/20 train-test split to simulate unseen product conditions."
    - "R² > 0.90 means the model explains >90% of price variance — strong signal."
    - "MAE of ₹X means on average the model is ₹X away from the business-optimal price before guardrails."
"""

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import json
import os
import datetime

# ── Load Data ─────────────────────────────────────────────────────────────────
DATA_PATH = "pricing_training_data.csv"
MODEL_OUTPUT_PATH = os.path.join("..", "backend", "ml_inference", "xgboost_pricing_model.json")
VERSION_OUTPUT_PATH = os.path.join("..", "backend", "ml_inference", "model_version.txt")

if not os.path.exists(DATA_PATH):
    raise FileNotFoundError(
        f"Training data not found at {DATA_PATH}. "
        "Run: python generate_dummy_data.py first."
    )

print(f"Loading training data from {DATA_PATH}...")
df = pd.read_csv(DATA_PATH)
print(f"  Loaded {len(df)} rows × {len(df.columns)} columns")

# ── Define features and target ────────────────────────────────────────────────
# MUST match the feature vector order in featureExtractor.js and predict.py
FEATURE_COLUMNS = [
    "cost_price",               # [0]
    "current_price",            # [1]
    "price_to_cost_ratio",      # [2]
    "target_margin",            # [3]
    "competitor_median_price",  # [4]
    "competitor_gap_pct",       # [5]
    "inventory_coverage_days",  # [6]
    "available_quantity",       # [7]
    "ema_daily_sales",          # [8]
    "demand_velocity_ratio",    # [9]
    "organic_sales_ratio",      # [10]
    "rolling_avg_sales_7d",     # [11]
    "day_of_week",              # [12]
    "month_of_year",            # [13]
    "is_festival_period",       # [14]
    "seasonal_multiplier",      # [15]
    "is_promotional_event_active", # [16]
    "category_encoded",         # [17]
    "tier_encoded",             # [18]
]
TARGET_COLUMN = "target_price"

X = df[FEATURE_COLUMNS]
y = df[TARGET_COLUMN]

print(f"\nFeature columns: {len(FEATURE_COLUMNS)}")
print(f"Target range:    ₹{y.min():,.2f} — ₹{y.max():,.2f}")

# ── Train / Test split ────────────────────────────────────────────────────────
# Stratification not used for regression — simple random split.
# random_state=42 ensures reproducibility for interview demonstrations.
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)
print(f"\nTrain size: {len(X_train)} | Test size: {len(X_test)}")

# ── Train XGBoost Model ───────────────────────────────────────────────────────
print("\nTraining XGBoost Regressor...")

model = xgb.XGBRegressor(
    # Tree structure
    n_estimators=100,           # number of boosting rounds
    max_depth=3,                # max tree depth — kept shallow to avoid overfitting on synthetic data
    min_child_weight=5,         # min samples per leaf — prevents overfitting on small clusters

    # Learning rate
    learning_rate=0.1,          # step size shrinkage

    # Regularization
    subsample=0.8,              # fraction of samples per tree
    colsample_bytree=0.8,       # fraction of features per tree
    reg_alpha=0.1,              # L1 regularization (feature selection pressure)
    reg_lambda=1.0,             # L2 regularization (weight magnitude control)

    # Objective
    objective="reg:squarederror",
    eval_metric="rmse",

    # Reproducibility
    random_state=42,
    n_jobs=-1,                  # use all available CPU cores
)

# Fit with early stopping evaluation for transparency
eval_set = [(X_train, y_train), (X_test, y_test)]
model.fit(
    X_train, y_train,
    eval_set=eval_set,
    verbose=False,
)

print("  Training complete!")

# ── Evaluate ──────────────────────────────────────────────────────────────────
y_pred = model.predict(X_test)

mae  = mean_absolute_error(y_test, y_pred)
rmse = np.sqrt(mean_squared_error(y_test, y_pred))
r2   = r2_score(y_test, y_pred)

print(f"\n{'='*50}")
print("MODEL EVALUATION RESULTS")
print(f"{'='*50}")
print(f"  MAE  (Mean Absolute Error):        ₹{mae:>8.2f}")
print(f"  RMSE (Root Mean Squared Error):    ₹{rmse:>8.2f}")
print(f"  R²   (Coefficient of Determination): {r2:>7.4f}")
print(f"{'='*50}")

if r2 >= 0.90:
    print("  ✅ R² > 0.90 — Excellent model fit")
elif r2 >= 0.80:
    print("  ⚠️  R² 0.80–0.90 — Good fit; consider more data or features")
else:
    print("  ❌ R² < 0.80 — Model may be underfitting; check feature correlations")

# ── Feature Importance ────────────────────────────────────────────────────────
importance_dict = dict(zip(FEATURE_COLUMNS, model.feature_importances_))
sorted_importance = sorted(importance_dict.items(), key=lambda x: x[1], reverse=True)

print(f"\nFEATURE IMPORTANCE (top 10):")
print(f"{'Feature':<35} {'Importance':>10}")
print("-" * 47)
for feat, imp in sorted_importance[:10]:
    bar = "█" * int(imp * 50)
    print(f"  {feat:<33} {imp:>8.4f}  {bar}")

# Try to plot feature importance (optional — won't crash if matplotlib absent)
try:
    import matplotlib.pyplot as plt

    plt.figure(figsize=(10, 6))
    features_sorted = [f for f, _ in sorted_importance]
    importances_sorted = [i for _, i in sorted_importance]
    colors = ["#4F46E5" if i > 0.1 else "#6B7280" for i in importances_sorted]

    plt.barh(features_sorted[::-1], importances_sorted[::-1], color=colors[::-1])
    plt.xlabel("Feature Importance Score")
    plt.title("XGBoost Feature Importance — Dynamic Pricing Engine")
    plt.tight_layout()
    plt.savefig("feature_importance.png", dpi=150, bbox_inches="tight")
    print("\n  📊 Feature importance chart saved to feature_importance.png")
except ImportError:
    print("\n  (matplotlib not installed — skipping importance chart)")

# ── Save Model ────────────────────────────────────────────────────────────────
os.makedirs(os.path.dirname(MODEL_OUTPUT_PATH), exist_ok=True)
model.save_model(MODEL_OUTPUT_PATH)

# Write model version (timestamp-based)
version = datetime.datetime.now().strftime("1.0.%Y%m%d")
with open(VERSION_OUTPUT_PATH, "w") as f:
    f.write(version)

# Write training metadata sidecar (useful for MLOps tracking)
metadata = {
    "version": version,
    "trained_at": datetime.datetime.utcnow().isoformat() + "Z",
    "training_rows": len(X_train),
    "test_rows": len(X_test),
    "features": FEATURE_COLUMNS,
    "hyperparameters": {
        "n_estimators": 100,
        "max_depth": 3,
        "learning_rate": 0.1,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
    },
    "evaluation": {
        "mae": round(float(mae), 4),
        "rmse": round(float(rmse), 4),
        "r2": round(float(r2), 4),
    },
    "feature_importance": {k: round(float(v), 6) for k, v in sorted_importance},
}

metadata_path = os.path.join("..", "backend", "ml_inference", "model_metadata.json")
with open(metadata_path, "w") as f:
    json.dump(metadata, f, indent=2)

print(f"\n✅ Model saved to:    {MODEL_OUTPUT_PATH}")
print(f"✅ Version saved to:  {VERSION_OUTPUT_PATH}")
print(f"✅ Metadata saved to: {metadata_path}")
print(f"\n🚀 Next step: restart the Node.js backend to hot-reload the model.")
print(f"   The server will log: [MLPredictor] Model loaded — version {version}")
