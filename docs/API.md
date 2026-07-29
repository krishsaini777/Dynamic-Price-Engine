# Pricing API Documentation

## POST `/api/v1/pricing/calculate`
Runs the dynamic pricing engine for a specific product.

**Body:**
```json
{
  "productId": "651a2b3c4d5e",
  "triggeredBy": "manual",
  "referenceDate": "2026-07-05T12:00:00Z"
}
```

**Response:** Returns the newly created `PricingRecommendation`.

---

## GET `/api/v1/pricing/model-status`
Returns the status of the XGBoost ML model.

**Response:**
```json
{
  "success": true,
  "data": {
    "loaded": true,
    "version": "1.0.20260705",
    "mode": "hybrid_xgboost"
  }
}
```

---

## GET `/api/v1/pricing/prediction-logs/:productId`
Returns a history of ML predictions vs Final Applied prices for a product.

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "mlPredictions": 24,
      "avgGuardrailPriceShift": -12.50
    },
    "logs": [ ... ]
  }
}
```

---

## PATCH `/api/v1/pricing/:decisionId/apply`
Applies a recommended price to the live product catalog.

---

## PATCH `/api/v1/pricing/:decisionId/reject`
Marks a recommendation as rejected, retaining it for audit history.
