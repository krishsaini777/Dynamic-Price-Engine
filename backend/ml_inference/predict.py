"""
predict.py — XGBoost inference script for the Dynamic Pricing Engine.

USAGE:
    python predict.py '[0, 1, 2, ..., 18]'   # 19-element JSON array

OUTPUT:
    JSON to stdout: {"predictedPrice": 1249.0}

DESIGN DECISIONS:
    - Receives feature vector as a command-line argument (JSON string).
    - Loads the model fresh on each invocation (acceptable for MVP;
      in production replace with a persistent FastAPI/ONNX service).
    - All errors are written to stderr. Stdout contains ONLY valid JSON.
    - Exit code 0 on success, 1 on any error.

FEATURE VECTOR ORDER (MUST match featureExtractor.js exactly):
    [0]  costPrice
    [1]  currentPrice
    [2]  priceToCostratio
    [3]  targetMargin
    [4]  competitorMedianPrice
    [5]  competitorGapPct
    [6]  inventoryCoverageDays
    [7]  availableQuantity
    [8]  emaDailySales
    [9]  demandVelocityRatio
    [10] organicSalesRatio
    [11] rollingAvgSales7d
    [12] dayOfWeek
    [13] monthOfYear
    [14] isFestivalPeriod
    [15] seasonalMultiplier
    [16] isPromotionalEventActive
    [17] categoryEncoded
    [18] tierEncoded
"""

import sys
import json
import os
import time

def main():
    start_time = time.time()

    # ── Parse input ───────────────────────────────────────────────────────────
    if len(sys.argv) < 2:
        print("ERROR: No feature vector provided", file=sys.stderr)
        sys.exit(1)

    try:
        features = json.loads(sys.argv[1])
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON input: {e}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(features, list) or len(features) != 19:
        print(f"ERROR: Expected 19 features, got {len(features) if isinstance(features, list) else 'non-list'}", file=sys.stderr)
        sys.exit(1)

    # ── Load model ────────────────────────────────────────────────────────────
    model_path = os.path.join(os.path.dirname(__file__), "xgboost_pricing_model.json")

    if not os.path.exists(model_path):
        print(f"ERROR: Model file not found at {model_path}", file=sys.stderr)
        sys.exit(1)

    try:
        import xgboost as xgb
        import numpy as np
    except ImportError as e:
        print(f"ERROR: Required library not installed: {e}. Run: pip install xgboost numpy", file=sys.stderr)
        sys.exit(1)

    try:
        model = xgb.XGBRegressor()
        model.load_model(model_path)
    except Exception as e:
        print(f"ERROR: Failed to load model: {e}", file=sys.stderr)
        sys.exit(1)

    # ── Run inference ─────────────────────────────────────────────────────────
    try:
        feature_array = np.array([features], dtype=float)  # shape (1, 19)
        predicted_price = float(model.predict(feature_array)[0])

        # Sanity check: predicted price must be positive and finite
        if not (0 < predicted_price < 10_000_000):
            print(f"ERROR: Predicted price {predicted_price} is out of valid range", file=sys.stderr)
            sys.exit(1)

    except Exception as e:
        print(f"ERROR: Inference failed: {e}", file=sys.stderr)
        sys.exit(1)

    # ── Output result ─────────────────────────────────────────────────────────
    latency_ms = round((time.time() - start_time) * 1000, 2)

    result = {
        "predictedPrice": round(predicted_price, 2),
        "latencyMs": latency_ms,
    }

    print(json.dumps(result))
    sys.exit(0)


if __name__ == "__main__":
    main()
