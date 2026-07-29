# Dynamic Pricing Engine Architecture

## 1. System Overview
The Dynamic Pricing Engine uses a **Hybrid Architecture** combining Machine Learning (XGBoost) and Deterministic Business Rules.

> **Core Philosophy:** "AI proposes, Business Rules approve."

### 1.1 Architecture Diagram
```
Browser (React + Vite)
      ↕  JWT Auth
Express.js API (Node.js)
      ├── FeatureExtractor.js (reads 19 features from MongoDB)
      ├── MLPredictor.js (spawns Python XGBoost inference)
      ├── PricingGuardrails.js (7 deterministic constraints)
      └── AI Service (Google Gemini explanations)
```

## 2. Core Components

### 2.1 Pricing Orchestrator (`pricingEngine.js`)
The central coordinator that executes the pipeline in this order:
1. Extract features
2. Get ML prediction (or deterministic fallback if ML fails)
3. Apply guardrails
4. Apply promotional events (overlay)
5. Generate AI explanation
6. Persist audit logs

### 2.2 Feature Extractor (`featureExtractor.js`)
Builds a normalized 19-element feature vector. This is the only service that reads from MongoDB for pricing optimization, ensuring the ML layer receives clean, structured data.

### 2.3 ML Predictor (`mlPredictor.js`)
A Node.js service that spawns a Python child process (`predict.py`) to run inference on the XGBoost model. 
* **Fallback Strategy:** If Python is unavailable or errors, it silently falls back to the legacy deterministic multiplier logic.

### 2.4 Pricing Guardrails (`pricingGuardrails.js`)
7 hardcoded business rules that can never be overridden by the ML model:
1. **Profit Floor:** `cost × 1.15`
2. **Price Ceiling:** `cost × 3.0`
3. **Stability Clamp:** Max `±15%` daily swing
4. **Competitor Cap:** Max `+8%` above market median
5. **Inventory Pressure:** ±5% for stock extremes
6. **Minimum Change:** Suppress <1% tweaks
7. **Charm Pricing:** Round to nearest `₹X49` or `₹X99`

## 3. Data Models

* **Product:** Base catalog (cost, target margin)
* **Inventory:** Stock levels and EMA daily sales
* **CompetitorPrice:** Scraped market prices
* **PricingRecommendation:** The final applied/rejected decision
* **MLPredictionLog:** Audit trail of raw ML outputs vs guardrail shifts
