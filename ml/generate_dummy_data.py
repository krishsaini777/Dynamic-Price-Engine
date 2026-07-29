"""
generate_dummy_data.py — Training data generator for the Hybrid Pricing Engine.

USAGE:
    cd ml/
    python generate_dummy_data.py

OUTPUT:
    pricing_training_data.csv (5000 rows × 20 columns)

DESIGN PHILOSOPHY:
    The data is NOT random. Every feature is causally correlated with the
    target variable (optimal_price) using the SAME pricing logic as the
    deterministic engine. This means:

    (a) XGBoost learns to approximate our business logic.
    (b) The model generalizes to COMBINATIONS of signals that the rule-based
        engine handles with simple thresholds.
    (c) The model will naturally discover interactions we haven't hardcoded
        (e.g., "low inventory + competitor cheaper → don't raise too much").

    2% Gaussian noise is added to prevent memorization of the exact formula.

FEATURE VECTOR ORDER (must match featureExtractor.js and predict.py):
    [0]  cost_price
    [1]  current_price
    [2]  price_to_cost_ratio
    [3]  target_margin
    [4]  competitor_median_price
    [5]  competitor_gap_pct
    [6]  inventory_coverage_days
    [7]  available_quantity
    [8]  ema_daily_sales
    [9]  demand_velocity_ratio
    [10] organic_sales_ratio
    [11] rolling_avg_sales_7d
    [12] day_of_week
    [13] month_of_year
    [14] is_festival_period
    [15] seasonal_multiplier
    [16] is_promotional_event_active
    [17] category_encoded
    [18] tier_encoded
    [19] target_price              ← TARGET VARIABLE (not a feature at inference time)
"""

import numpy as np
import pandas as pd

# ── Reproducibility ───────────────────────────────────────────────────────────
np.random.seed(42)
N = 5000

print(f"Generating {N} rows of causally-correlated training data...")

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1: Generate base features
# ═══════════════════════════════════════════════════════════════════════════════

# Cost price: ₹500 – ₹5000 (covers budget to premium electronics/apparel range)
cost_price = np.random.uniform(500, 5000, N)

# Target margin: 10% – 30% (typical e-commerce margins)
target_margin = np.random.uniform(0.10, 0.30, N)

# Current price: already exists in the market (cost + some existing margin)
# We simulate that the current price may be slightly below or above optimal
current_price = cost_price * np.random.uniform(1.15, 2.0, N)

# Price to cost ratio
price_to_cost_ratio = current_price / cost_price

# Category: 0–9 encoding (matches featureExtractor.js CATEGORY_ENCODING)
# Electronics(0) and Premium(2) tend to have higher margins in training
category_encoded = np.random.randint(0, 10, N)

# Tier: 0=budget, 1=mid, 2=premium
# premium tier → higher base multiplier in optimal price
tier_encoded = np.random.randint(0, 3, N)

# ── Inventory features ────────────────────────────────────────────────────────
# EMA daily sales (organic): 1–50 units per day
ema_daily_sales = np.random.uniform(1, 50, N)

# Available quantity: wide range to simulate all inventory scenarios
available_quantity = np.random.randint(0, 500, N)

# Coverage days: qty / ema_sales (capped at 999 for very slow-moving items)
inventory_coverage_days = np.where(
    ema_daily_sales > 0,
    np.minimum(available_quantity / ema_daily_sales, 999),
    999,
)

# Rolling 7d avg sales: similar to EMA but with some variance
rolling_avg_sales_7d = ema_daily_sales * np.random.uniform(0.7, 1.3, N)

# ── Demand features ───────────────────────────────────────────────────────────
# Velocity ratio: 6h rate / 7d baseline (>1 = rising, <1 = falling)
demand_velocity_ratio = np.random.lognormal(mean=0.0, sigma=0.5, size=N)
demand_velocity_ratio = np.clip(demand_velocity_ratio, 0.1, 10.0)

# Organic sales ratio: fraction of sales that are organic (not promotional)
organic_sales_ratio = np.random.beta(8, 2, N)  # skewed toward high organic

# ── Competitor features ───────────────────────────────────────────────────────
# Competitor prices cluster around our price ±20%
competitor_median_price = current_price * np.random.uniform(0.80, 1.20, N)
competitor_gap_pct = ((competitor_median_price - current_price) / current_price) * 100

# ── Calendar features ─────────────────────────────────────────────────────────
day_of_week = np.random.randint(0, 7, N)      # 0=Mon, 6=Sun
month_of_year = np.random.randint(1, 13, N)   # 1=Jan, 12=Dec

# Festival indicator: Oct–Nov (months 10–11) and Dec–Jan are festival seasons
is_festival_period = np.where(
    np.isin(month_of_year, [1, 3, 10, 11, 12]), 1, 0
)

# Seasonal multiplier: festivals boost by up to 12%, off-season neutral
seasonal_multiplier = np.where(
    is_festival_period == 1,
    np.random.uniform(1.02, 1.12, N),  # festival: +2% to +12%
    np.random.uniform(0.95, 1.02, N),  # off-season: -5% to +2%
)

# Promotional event: 20% of records have an active promo
is_promotional_event_active = np.random.binomial(1, 0.20, N)

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2: Compute target variable (optimal price) using causal logic
#
# This encodes the SAME business logic as the deterministic pricing engine,
# extended with feature interactions the rule-based engine can't capture.
# ═══════════════════════════════════════════════════════════════════════════════

# Base price: cost + target margin (the profitability floor)
base_price = cost_price * (1 + target_margin)

# ── Demand multiplier (mirrors computeDemandSignal) ───────────────────────────
demand_multiplier = np.where(demand_velocity_ratio > 5,  1.15,
                    np.where(demand_velocity_ratio > 2,  1.10,
                    np.where(demand_velocity_ratio > 1.2, 1.05,
                    np.where(demand_velocity_ratio > 0.8, 1.00,
                    np.where(demand_velocity_ratio > 0.5, 0.96, 0.92)))))

# ── Inventory multiplier (mirrors computeInventorySignal) ─────────────────────
inventory_multiplier = np.where(inventory_coverage_days == 0,   1.20,
                       np.where(inventory_coverage_days < 3,    1.15,
                       np.where(inventory_coverage_days < 7,    1.06,
                       np.where(inventory_coverage_days < 15,   1.00, 0.92))))

# ── Competitor adjustment (mirrors computeCompetitorSignal, capped at ±8%) ────
raw_competitor_gap = competitor_gap_pct * 0.4  # 40% weight from gap
clamped_competitor = np.clip(raw_competitor_gap, -8, 8)
competitor_multiplier = 1.0 + clamped_competitor / 100

# ── Tier premium ──────────────────────────────────────────────────────────────
# Premium products command a higher multiplier — a non-linear interaction
# between tier and demand that the rule-based engine cannot capture.
tier_multiplier = np.where(tier_encoded == 2, np.random.uniform(1.05, 1.15, N),  # premium
                  np.where(tier_encoded == 1, np.random.uniform(1.00, 1.05, N),  # mid
                  np.random.uniform(0.95, 1.00, N)))                               # budget

# ── Compose the optimal price ─────────────────────────────────────────────────
optimal_price = (
    base_price
    * demand_multiplier
    * inventory_multiplier
    * competitor_multiplier
    * seasonal_multiplier
    * tier_multiplier
)

# Weekend effect: prices are typically 2-3% higher on weekends (Fri–Sun)
weekend_boost = np.where(np.isin(day_of_week, [4, 5, 6]),
                          np.random.uniform(1.01, 1.03, N),
                          1.0)
optimal_price = optimal_price * weekend_boost

# Festival effect: additional 3-8% boost during major festival months
festival_boost = np.where(is_festival_period == 1,
                           np.random.uniform(1.03, 1.08, N),
                           1.0)
optimal_price = optimal_price * festival_boost

# Promotional event: during promos, optimal price is lower (event discount applied)
promo_discount = np.where(is_promotional_event_active == 1,
                           np.random.uniform(0.85, 0.95, N),
                           1.0)
optimal_price = optimal_price * promo_discount

# ── Hard constraints (mirrors PricingGuardrails) ──────────────────────────────
profit_floor = cost_price * 1.15
price_ceiling = cost_price * 3.0
stability_min = current_price * 0.85
stability_max = current_price * 1.15

optimal_price = np.maximum(optimal_price, profit_floor)   # G1: profit floor
optimal_price = np.minimum(optimal_price, price_ceiling)  # G2: price ceiling
optimal_price = np.clip(optimal_price, stability_min, stability_max)  # G3: stability

# ── Add 2% Gaussian noise to prevent overfitting ─────────────────────────────
# Without noise, XGBoost would memorize the exact formula above.
# With 2% noise, it learns the underlying patterns while tolerating variance.
noise = np.random.normal(loc=1.0, scale=0.02, size=N)
optimal_price = optimal_price * noise

# Final sanity clamp after noise
optimal_price = np.maximum(optimal_price, profit_floor)
optimal_price = np.round(optimal_price, 2)

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3: Assemble DataFrame and save
# ═══════════════════════════════════════════════════════════════════════════════

df = pd.DataFrame({
    # Features (19 columns — must match featureExtractor.js order)
    "cost_price":                  np.round(cost_price, 2),
    "current_price":               np.round(current_price, 2),
    "price_to_cost_ratio":         np.round(price_to_cost_ratio, 4),
    "target_margin":               np.round(target_margin, 4),
    "competitor_median_price":     np.round(competitor_median_price, 2),
    "competitor_gap_pct":          np.round(competitor_gap_pct, 4),
    "inventory_coverage_days":     np.round(inventory_coverage_days, 2),
    "available_quantity":          available_quantity.astype(int),
    "ema_daily_sales":             np.round(ema_daily_sales, 3),
    "demand_velocity_ratio":       np.round(demand_velocity_ratio, 4),
    "organic_sales_ratio":         np.round(organic_sales_ratio, 4),
    "rolling_avg_sales_7d":        np.round(rolling_avg_sales_7d, 3),
    "day_of_week":                 day_of_week.astype(int),
    "month_of_year":               month_of_year.astype(int),
    "is_festival_period":          is_festival_period.astype(int),
    "seasonal_multiplier":         np.round(seasonal_multiplier, 4),
    "is_promotional_event_active": is_promotional_event_active.astype(int),
    "category_encoded":            category_encoded.astype(int),
    "tier_encoded":                tier_encoded.astype(int),
    # Target variable
    "target_price":                optimal_price,
})

output_path = "pricing_training_data.csv"
df.to_csv(output_path, index=False)

# ── Summary statistics ────────────────────────────────────────────────────────
print(f"\n✅ Generated {len(df)} rows → {output_path}")
print(f"\nTarget price statistics:")
print(f"  Min:    ₹{df['target_price'].min():,.2f}")
print(f"  Max:    ₹{df['target_price'].max():,.2f}")
print(f"  Mean:   ₹{df['target_price'].mean():,.2f}")
print(f"  Median: ₹{df['target_price'].median():,.2f}")
print(f"  Std:    ₹{df['target_price'].std():,.2f}")
print(f"\nCorrelations with target_price (top 5):")
correlations = df.corr()["target_price"].drop("target_price").abs().sort_values(ascending=False)
print(correlations.head(5).to_string())
print(f"\nNext step: python train_xgboost.py")
