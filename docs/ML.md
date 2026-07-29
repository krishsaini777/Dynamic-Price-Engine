# Machine Learning Pipeline

## 1. Overview
The pricing engine uses an **XGBoost Regressor** to predict optimal prices. It takes 19 features (inventory, demand, competitor data, seasonality) and predicts a continuous price target.

## 2. Feature Vector
The ML model expects a strictly ordered 19-element float array:
1. `cost_price`
2. `current_price`
3. `price_to_cost_ratio`
4. `target_margin`
5. `competitor_median_price`
6. `competitor_gap_pct`
7. `inventory_coverage_days`
8. `available_quantity`
9. `ema_daily_sales`
10. `demand_velocity_ratio`
11. `organic_sales_ratio`
12. `rolling_avg_sales_7d`
13. `day_of_week`
14. `month_of_year`
15. `is_festival_period` (1 or 0)
16. `seasonal_multiplier`
17. `is_promotional_event_active` (1 or 0)
18. `category_encoded` (integer label)
19. `tier_encoded` (integer label)

## 3. Training
* **Script:** `ml/train_xgboost.py`
* **Dataset:** 5,000 synthetically generated, causally-correlated rows (`ml/generate_dummy_data.py`).
* **Hyperparameters:** `max_depth=3`, `n_estimators=100`, `learning_rate=0.1`. (Kept shallow to avoid overfitting the synthetic data).
* **Metrics:** Evaluated on MAE, RMSE, and R².

## 4. Inference layer
Node.js does not run the model natively. Instead, `mlPredictor.js` spawns a Python child process (`predict.py`) which loads the JSON model and performs inference in milliseconds.

## 5. Audit Logging
Every prediction is logged to MongoDB in the `MLPredictionLog` collection with a 90-day TTL index. This allows ML Engineers to track model drift and analyze which guardrails are firing most frequently.
