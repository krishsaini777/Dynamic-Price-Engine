# Dynamic Pricing Engine

> A production-grade, **XGBoost-powered** e-commerce pricing system. The ML model proposes an optimal price from **19 real-time market features**, which is then validated by **7 deterministic business guardrails**, and explained in plain English via **Gemini AI**.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=flat-square&logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=flat-square&logo=python)](https://www.python.org/)
[![XGBoost](https://img.shields.io/badge/XGBoost-ML%20Model-FF6600?style=flat-square)](https://xgboost.readthedocs.io/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat-square&logo=mongodb)](https://www.mongodb.com/atlas)
[![Frontend](https://img.shields.io/badge/Frontend-Vercel-black?style=flat-square&logo=vercel)](https://dynamic-pricing-frontend-theta.vercel.app)
[![Backend](https://img.shields.io/badge/Backend-Render-46E3B7?style=flat-square&logo=render)](https://dynamic-pricing-engine-m3u7.onrender.com/health)

---

## Table of Contents

- [Overview](#overview)
- [Live Demo](#live-demo)
- [How It Works (Hybrid Pipeline)](#how-it-works-hybrid-pipeline)
- [ML Model](#ml-model)
- [Business Guardrails](#business-guardrails)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [ML Setup (Training)](#ml-setup-training)
  - [Frontend Setup](#frontend-setup)
- [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)
- [Build & Deployment](#build--deployment)
- [API Overview](#api-overview)
- [Database Design](#database-design)
- [Security](#security)
- [Error Handling](#error-handling)
- [Performance](#performance)
- [Limitations](#limitations)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgements](#acknowledgements)

---

## Overview

Traditional rule-based pricing uses rigid logic like *"if demand is high, add 10%."* This breaks down in real markets where demand, inventory, competitor behaviour, and seasonality interact in non-linear ways.

**Dynamic Pricing Engine** takes a different approach:

1. **XGBoost proposes** — A trained ML model receives 19 real-time market features and predicts the optimal price.
2. **Guardrails approve** — 7 deterministic business rules (profit floor, price ceiling, stability clamp, etc.) validate and constrain the ML output.
3. **Gemini explains** — Google Gemini AI generates a plain-English rationale for every recommendation, making the system auditable by non-technical users.
4. **Audit log records** — Every decision stores a complete snapshot of all inputs so any historical price can be reconstructed and explained.

---

## Live Demo

| Service | URL |
|---------|-----|
| **Frontend** | [https://dynamic-pricing-frontend-theta.vercel.app](https://dynamic-pricing-frontend-theta.vercel.app) |
| **Backend API** | [https://dynamic-pricing-engine-m3u7.onrender.com](https://dynamic-pricing-engine-m3u7.onrender.com) |
| **Health Check** | [https://dynamic-pricing-engine-m3u7.onrender.com/health](https://dynamic-pricing-engine-m3u7.onrender.com/health) |

> **Note:** The backend is on Render's free tier and cold-starts in ~60 seconds after inactivity. Hit `/health` first to wake it up.

---

## How It Works (Hybrid Pipeline)

The pricing pipeline runs in a strict sequence:

```
User Triggers Pricing (manual / scheduler / API)
          │
          ▼
┌─────────────────────┐
│   Feature Extractor  │  ← Reads MongoDB, builds 19-feature vector
│   (featureExtractor) │    (parallel DB reads with Promise.all)
└──────────┬──────────┘
           │  vector: [costPrice, currentPrice, demandVelocityRatio, ...]
           ▼
┌─────────────────────┐
│   XGBoost Inference  │  ← Node spawns Python child_process
│   (mlPredictor.js)   │    predict.py loads model, returns { predictedPrice }
└──────────┬──────────┘
           │  proposedPrice = mlResult.predictedPrice
           │  (if ML fails → deterministic signal composition is used as fallback)
           ▼
┌─────────────────────┐
│  Business Guardrails │  ← 7 rules applied in priority order
│  (pricingGuardrails) │    (same rules for both ML and fallback paths)
└──────────┬──────────┘
           │  finalPrice = guardrail-approved price
           ▼
┌─────────────────────┐
│   Event Overlay      │  ← Promotional discount applied AFTER optimization
│   (eventService)     │    (separates promotions pipeline from pricing pipeline)
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│   AI Explanation     │  ← Gemini 2.0 Flash generates plain-English rationale
│   (aiService)        │    (includes ML context: model version, raw ML price)
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│   Audit Logs         │  ← PricingRecommendation (append-only)
│                      │  ← MLPredictionLog (ML-specific metadata, non-blocking)
└─────────────────────┘
```

### Fallback Strategy

If the ML model fails (Python not installed, model file missing, timeout), the engine **silently falls back** to deterministic signal composition: `Demand × Inventory × Competitor × Seasonal`. Both paths then pass through the same 7 guardrails. The API response always succeeds — it includes a `usedMLModel: false` flag so the UI can display the appropriate badge.

---

## ML Model

### Why XGBoost?

| Factor | Reason |
|--------|--------|
| **Tabular data** | Our 19 features are structured numerical/categorical columns — XGBoost outperforms neural networks here |
| **No large dataset needed** | XGBoost can generalise from thousands of rows; neural nets need millions |
| **Interpretable** | Feature importance scores let us explain which market signals drove a price |
| **Serialisable** | Saves to a single `.json` file, loadable by the Node.js server without a Python runtime keeping warm |
| **Regulatory** | Tree models are more auditable than neural networks — important for pricing decisions |

### Feature Vector (19 Features)

The `featureExtractor.js` service reads from MongoDB and assembles this exact vector, in this exact order, every time:

| Index | Feature | Description |
|-------|---------|-------------|
| `[0]` | `costPrice` | Product cost to the business |
| `[1]` | `currentPrice` | Current live market price |
| `[2]` | `priceToCostratio` | `currentPrice / costPrice` |
| `[3]` | `targetMargin` | Desired profit margin (0–1) |
| `[4]` | `competitorMedianPrice` | IQR-filtered competitor median (staleness-weighted) |
| `[5]` | `competitorGapPct` | `(competitorMedian - currentPrice) / currentPrice × 100` |
| `[6]` | `inventoryCoverageDays` | `availableQty / emaDailySales` |
| `[7]` | `availableQuantity` | Raw stock count |
| `[8]` | `emaDailySales` | Exponential Moving Average of organic daily sales |
| `[9]` | `demandVelocityRatio` | Short-term rate (6h) ÷ long-term baseline (7d) |
| `[10]` | `organicSalesRatio` | Organic sales ÷ total sales (0–1, excludes promotional noise) |
| `[11]` | `rollingAvgSales7d` | Mean daily organic sales over the last 7 days |
| `[12]` | `dayOfWeek` | 0 = Monday … 6 = Sunday |
| `[13]` | `monthOfYear` | 1 = January … 12 = December |
| `[14]` | `isFestivalPeriod` | `1` if in Diwali / Holi / Christmas / New Year window |
| `[15]` | `seasonalMultiplier` | Output of sigmoid-ramp seasonal signal (1.0 = neutral) |
| `[16]` | `isPromotionalEventActive` | `1` if a promo event is currently running for this product |
| `[17]` | `categoryEncoded` | Integer label: Electronics=0, Clothing=1, Home=2… |
| `[18]` | `tierEncoded` | 0=budget, 1=mid, 2=premium |

> **Critical:** The feature order in `featureExtractor.js`, `predict.py`, and `train_xgboost.py` **must always match**. Changing the order invalidates the trained model weights.

### Training Pipeline

The model is trained **offline** in Python. The trained artifact is committed to the repository and loaded at server startup.

```bash
# Step 1 — Generate synthetic training data
cd ml/
python generate_dummy_data.py
# Output: pricing_training_data.csv (~5,000 rows)

# Step 2 — Train the model
python train_xgboost.py
# Output:
#   ../backend/ml_inference/xgboost_pricing_model.json  ← the model
#   ../backend/ml_inference/model_version.txt           ← e.g. "1.0.20260705"
#   ../backend/ml_inference/model_metadata.json         ← metrics + hyperparams
#   feature_importance.png                              ← importance chart

# Step 3 — Restart the backend
# The server logs: [MLPredictor] Model loaded — version 1.0.20260705
```

### Hyperparameters

| Parameter | Value | Reason |
|-----------|-------|--------|
| `n_estimators` | 100 | 100 boosting rounds — enough capacity without overfitting |
| `max_depth` | 3 | Shallow trees → learns patterns, not noise |
| `min_child_weight` | 5 | Minimum 5 samples per leaf → prevents overfitting on small clusters |
| `learning_rate` | 0.1 | Standard; lower = more conservative generalisation |
| `subsample` | 0.8 | Trains each tree on 80% of rows → reduces variance |
| `colsample_bytree` | 0.8 | Uses 80% of features per tree → avoids feature dominance |
| `reg_alpha` | 0.1 | L1 regularisation (feature selection pressure) |
| `reg_lambda` | 1.0 | L2 regularisation (weight magnitude control) |

### Evaluation Targets

| Metric | Target | Interpretation |
|--------|--------|----------------|
| **MAE** (Mean Absolute Error) | < ₹100 | On average, the ML price is within ₹100 of the business-optimal price before guardrails |
| **RMSE** (Root Mean Squared Error) | < ₹150 | Penalises large errors; measures worst-case behaviour |
| **R²** (Coefficient of Determination) | > 0.90 | Model explains > 90% of price variance — strong signal |

### Model Serialisation & Loading

- The model is saved in **XGBoost's native JSON format** (`xgboost_pricing_model.json`), not pickle. This is portable, version-controlled, and human-inspectable.
- At backend startup, `mlPredictor.js` checks if the model file and inference script exist. If both are present, `_modelLoaded = true`. If either is missing, the system logs a warning and all requests use the deterministic fallback — **no crash, no downtime**.

### Inference Flow (Node → Python)

```
pricingEngine.js
  → mlPredict(featureVector)           # mlPredictor.js
    → spawn('python', ['predict.py', JSON.stringify(vector)])
      → predict.py loads model.json
      → model.predict(np.array([vector]))
      → prints { "predictedPrice": 1249.0, "latencyMs": 220 }
    ← Node.js reads stdout, parses JSON
  ← returns { predictedPrice, predictionLatencyMs, usedFallback, modelVersion }
```

- **Timeout:** 10-second hard limit on the Python child process.
- **Latency:** ~150–400ms per inference (acceptable for a pricing recommendation — not a hot path).
- **Production note:** This can be replaced with ONNX runtime (`onnxruntime-node`) for ~5ms inference with no Python dependency.

### Confidence Scoring

Confidence is a weighted score across all available signals:

```
score = 0.35 × demand.confidence
      + 0.25 × inventory.confidence
      + 0.20 × competitor.confidence
      + 0.05 × 1.0 (seasonal — always available)
      + 0.15 × ml_bonus (1.0 if ML succeeded, 0.0 if fallback)
```

The 15% ML bonus rewards the system for successfully running the full pipeline. A fallback result will always have lower confidence, reflecting higher uncertainty.

| Score | Level |
|-------|-------|
| ≥ 0.75 | `HIGH` |
| ≥ 0.50 | `MEDIUM` |
| < 0.50 | `LOW` |

### Retraining Strategy

Since training data is synthetic (generated by `generate_dummy_data.py`), retrain when:
- Product catalogue grows significantly (new categories, tiers).
- A systematic bias is observed in production (e.g., consistent over-pricing for a category).
- New features are added to the vector.

In production, this would be replaced with a nightly job that trains on real sales history from MongoDB.

---

## Business Guardrails

The ML model **proposes** a price. The guardrails **approve** it. All 7 rules have absolute priority and are applied in this sequence:

| Priority | Rule | Logic |
|----------|------|-------|
| G1 | **Profit Floor** | `price ≥ costPrice × (1 + targetMargin)` — hard minimum. Cannot be overridden by any signal or ML output. |
| G2 | **Price Ceiling** | `price ≤ costPrice × 3.0` — prevents predatory pricing. |
| G3 | **Stability Clamp** | `±15%` max change per cycle — dampens XGBoost demand surge hallucinations. |
| G4 | **Competitor Cap** | Cannot exceed competitor median by > 8% — prevents market isolation. |
| G5 | **Inventory Rule** | Coverage < 7 days: +5%; Coverage > 30 days: −5% — safety valve on top of ML signal. |
| G6 | **Minimum Change** | Changes < 1% are suppressed — avoids price flicker. |
| G7 | **Charm Pricing** | Rounds to nearest ₹X49 or ₹X99 — cosmetic psychological pricing. |

Every guardrail that fires is logged to `guardrailsApplied` in the `MLPredictionLog` audit record.

---

## Key Features

### Pricing Engine
- **XGBoost ML Model** — primary price proposal from 19 real-time market features
- **Deterministic Fallback** — signal composition (`D × I × C × S`) activates automatically when ML fails
- **7 Business Guardrails** — profit floor, ceiling, stability clamp, competitor cap, inventory rule, minimum change, charm pricing
- **Confidence Scoring** — weighted multi-signal score with `HIGH` / `MEDIUM` / `LOW` classification; includes ML success bonus
- **Append-Only Audit Log** — `PricingRecommendation` stores the full input snapshot for every decision
- **MLPredictionLog** — separate ML-specific audit record (feature vector, model version, inference latency, guardrails fired)
- **Background Scheduler** — auto-applies `HIGH` confidence recommendations every 30 minutes via `node-cron`

### Demand Engine
- **EMA Demand Velocity** — Exponential Moving Average of organic daily sales; compares 6-hour rate vs 7-day baseline
- **Organic / Promotional Attribution** — every sale is tagged; promotional sales are excluded from the EMA baseline to prevent signal contamination
- **Velocity Ratio** — `shortTermRate / longTermRate` fed directly as feature `[9]` to XGBoost

### Events & Promotions
- **Event Lifecycle** — `DRAFT → SCHEDULED → ACTIVE → EXPIRED` state machine
- **Post-ML Overlay** — promotional discount is applied *after* the ML-guardrail pipeline, keeping the pricing and promotions pipelines cleanly separated
- **Demand Attribution** — every sale records the active event ID for accurate organic signal isolation

### Settings & Control
- **3-Tier Seasonal Control** — global toggle → per-category exclusions → per-product sigmoid ramp config
- **Scheduler Configuration** — configurable interval, auto-apply confidence threshold, enable/disable toggle

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, Tailwind CSS, Recharts, Lucide Icons, Axios |
| **Backend** | Node.js 18+, Express.js |
| **Database** | MongoDB Atlas, Mongoose ODM |
| **Authentication** | Firebase Authentication + Firebase Admin SDK |
| **AI (Generative)** | Google Gemini 2.0 Flash |
| **ML (Predictive)** | Python 3.9+, XGBoost, Scikit-Learn, NumPy, Pandas |
| **Scheduler** | node-cron |
| **Deployment** | Vercel (frontend), Render (backend) |

---

## Project Structure

```
dynamic-pricing-engine/
├── backend/
│   ├── server.js                      # Express entry point, CORS, routes
│   ├── .env.example                   # Environment variable template
│   ├── ml_inference/                  # Pre-trained ML artifacts (committed)
│   │   ├── xgboost_pricing_model.json # Serialised XGBoost model
│   │   ├── predict.py                 # Python inference script (called per request)
│   │   ├── model_version.txt          # e.g. "1.0.20260705"
│   │   └── model_metadata.json        # Training metrics + hyperparameters
│   └── src/
│       ├── config/                    # DB connection, Firebase Admin init
│       ├── models/                    # 9 Mongoose schemas
│       │   └── MLPredictionLog.js     # ML-specific audit record (new)
│       ├── controllers/               # 9 controller files (one per domain)
│       ├── routes/                    # 9 route files
│       └── services/
│           ├── pricingEngine.js       # Hybrid pipeline orchestrator
│           ├── featureExtractor.js    # Builds 19-feature vector from MongoDB
│           ├── mlPredictor.js         # Node → Python child_process interface
│           ├── pricingGuardrails.js   # 7 deterministic business rules
│           ├── aiService.js           # Gemini explanation generation
│           ├── demandAttribution.js   # EMA + organic/promo attribution
│           ├── eventService.js        # Event overlay pipeline
│           └── scheduler.js          # node-cron auto-apply engine
├── ml/                                # Offline training environment (Python)
│   ├── generate_dummy_data.py         # Synthetic training data generator
│   ├── train_xgboost.py               # Model training script
│   ├── pricing_training_data.csv      # Generated training data
│   └── feature_importance.png         # Feature importance chart
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── .env.example
│   └── src/
│       ├── api/                       # 8 API modules + axiosInstance
│       ├── components/                # 30+ components across 7 directories
│       │   └── pricing/
│       │       ├── RecommendationCard.jsx # Shows ML badge (AI vs Fallback)
│       │       ├── AIExplanationBox.jsx   # Gemini explanation display
│       │       ├── MLInsightsPanel.jsx    # ML model details panel
│       │       └── GuardrailList.jsx      # Shows guardrails that fired
│       ├── hooks/                     # 6 custom React hooks
│       └── pages/                     # 8 page components
└── docs/
    ├── API.md                         # Full API reference
    ├── ARCHITECTURE.md                # System design document
    └── ML.md                          # ML model documentation
```

---

## Getting Started

### Prerequisites

- **Node.js** v18 or higher
- **Python** v3.9 or higher (required for XGBoost inference at runtime)
- **pip** (Python package manager)
- **npm** v9 or higher
- A **MongoDB Atlas** account (free tier is sufficient)
- A **Google Gemini API** key — [get one here](https://aistudio.google.com/app/apikey)
- A **Firebase Web App** project for Authentication

---

### Backend Setup

```bash
# 1. Navigate to the backend directory
cd backend

# 2. Install Node.js dependencies
npm install

# 3. Install Python ML dependencies
pip install xgboost numpy pandas scikit-learn

# 4. Copy the environment variable template
cp .env.example .env
# Fill in your values (see Environment Variables section below)

# 5. (Optional) Seed the database with demo data
node src/config/seed.js

# 6. Start the development server
npm run dev
```

The API will be available at `http://localhost:5000`.

At startup, you should see:
```
[Firebase Admin] Initialized successfully.
[MLPredictor] Model loaded — version 1.0.20260705
MongoDB Connected: ...
[Scheduler] Started — pricing every 30min, EMA every 1h
Server running on port 5000
```

---

### ML Setup (Training)

The pre-trained model (`ml_inference/xgboost_pricing_model.json`) is already committed. You only need to retrain if you want to improve the model or modify features.

```bash
# Navigate to the ml/ directory
cd ml/

# Step 1: Generate training data
python generate_dummy_data.py
# Creates: pricing_training_data.csv (~5,000 rows)

# Step 2: Train the model
python train_xgboost.py
# Creates: ../backend/ml_inference/xgboost_pricing_model.json
#          ../backend/ml_inference/model_version.txt
#          ../backend/ml_inference/model_metadata.json
#          feature_importance.png

# Step 3: Restart the backend to hot-reload the new model
```

---

### Frontend Setup

```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Copy the environment variable template
cp .env.example .env
# Set VITE_API_URL and all VITE_FIREBASE_* variables

# 4. Start the development server
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Port the server listens on | `5000` |
| `NODE_ENV` | Environment mode | `development` or `production` |
| `MONGO_URL` | MongoDB Atlas connection string | `mongodb+srv://<user>:<pass>@cluster.mongodb.net/dynamic-pricing` |
| `GEMINI_API_KEY` | Google Gemini AI API key | `AIzaSy...` |
| `FRONTEND_URL` | Frontend origin for CORS whitelist | `https://your-app.vercel.app` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase Admin service account as a JSON string (production only) | `{"type":"service_account",...}` |

> **Local development:** Place your Firebase service account JSON file at `backend/src/config/firebase-service-account.json`. The server auto-detects it. For production (Render), paste the JSON content into the `FIREBASE_SERVICE_ACCOUNT_JSON` environment variable.

---

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL |
| `VITE_FIREBASE_API_KEY` | Firebase project API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | Firebase measurement ID |

> **Important:** Vite bakes environment variables into the bundle at build time. If deploying to Vercel, set all `VITE_*` variables in **Settings → Environment Variables** and trigger a redeploy.

---

## Running Locally

After completing setup, run both servers concurrently:

**Terminal 1 — Backend:**
```bash
cd backend && npm run dev
# API running at http://localhost:5000
# ML model loaded automatically from ml_inference/
```

**Terminal 2 — Frontend:**
```bash
cd frontend && npm run dev
# App running at http://localhost:5173
```

To verify the backend and ML model are healthy:
```
GET http://localhost:5000/health
```
```
GET http://localhost:5000/api/v1/pricing/model-status
```

---

## Build & Deployment

### Frontend (Vercel via CLI)

```bash
cd frontend
npx vercel --prod
```

Or, if using GitHub integration:
1. Connect your repository to Vercel and set the **root directory** to `frontend`.
2. Set all `VITE_*` environment variables in Vercel Dashboard → Settings → Environment Variables.
3. Deploy. Vercel rebuilds on every push to `main`.

### Backend (Render)

1. Create a new **Web Service** on Render.
2. Connect your repository and set the root directory to `backend`.
3. **Build Command:** `npm install && pip install xgboost numpy`
4. **Start Command:** `node server.js`
5. Add all required environment variables: `MONGO_URL`, `GEMINI_API_KEY`, `FRONTEND_URL`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `NODE_ENV=production`.
6. The `ml_inference/` directory (containing the pre-trained model and `predict.py`) is committed to the repository and will be available on Render automatically.

> **Note:** The Python inference script (`predict.py`) is invoked as a child process at runtime. Render's Node.js environment includes Python 3 by default.

> **Free tier note:** Render spins down services after 15 minutes of inactivity. The `/health` endpoint is designed for warm-up pings.

---

## API Overview

40+ REST endpoints across 9 resource domains. A Postman collection is available at `DynamicPricingEngine.postman_collection.json` — import it and set `{{BASE_URL}}`.

| Domain | Count | Key Endpoint |
|--------|-------|-------------|
| Products | 5 | `GET /api/v1/products` |
| Inventory | 5 | `GET /api/v1/inventory` |
| Sales | 3 | `POST /api/v1/sales` |
| Competitors | 5 | `GET /api/v1/competitors/:productId/analysis` |
| **Pricing** | **7** | **`POST /api/v1/pricing/calculate`** |
| Events | 11 | `PATCH /api/v1/events/:id/activate` |
| Settings | 5 | `PATCH /api/v1/settings/seasonal/toggle` |
| Dashboard | 1 | `GET /api/v1/dashboard/stats` |
| Analytics | 5 | `GET /api/v1/analytics/demand-attribution/:productId` |
| Health | 1 | `GET /health` |

### Core Endpoint Example

**`POST /api/v1/pricing/calculate`** — Run the hybrid pricing pipeline for a product.

```json
// Request
{
  "productId": "64f1a2b3c4d5e6f7a8b9c0d1",
  "triggeredBy": "manual",
  "referenceDate": "2025-01-15T10:00:00.000Z"
}

// Response
{
  "success": true,
  "data": {
    "recommendedPrice": 1249,
    "currentPrice": 1199,
    "usedMLModel": true,
    "mlRawPrice": 1261.5,
    "finalMultiplier": 1.042,
    "confidence": { "score": 0.83, "level": "HIGH" },
    "primaryDriver": "ml_model",
    "guardrailsApplied": [
      { "rule": "STABILITY_CLAMP", "detail": "Swing of 5.2% clamped to ±15% limit" },
      { "rule": "CHARM_PRICING", "detail": "Rounded ₹1251 → ₹1249" }
    ],
    "signals": {
      "demand": { "interpretation": "RISING", "velocityRatio": 1.31, "multiplier": 1.05 },
      "inventory": { "interpretation": "NORMAL", "coverageDays": 12.4, "multiplier": 1.0 },
      "competitor": { "interpretation": "NEAR_PARITY", "gapPercent": -0.8, "multiplier": 0.997 },
      "seasonal": { "phase": "ramp_up", "multiplier": 1.04 }
    },
    "aiExplanation": "The XGBoost model proposed ₹1,262 based on rising demand velocity (31% above baseline) and seasonal ramp-up. After the stability guardrail capped the swing at 15% and charm pricing rounded down, the final recommendation is ₹1,249...",
    "decision": { "_id": "...", "status": "PENDING" }
  }
}
```

**`GET /api/v1/pricing/model-status`** — Check ML model health.
```json
{
  "loaded": true,
  "version": "1.0.20260705",
  "modelFileExists": true,
  "scriptFileExists": true
}
```

---

## Database Design

9 MongoDB collections with strategic indexing for time-series queries and product lookups:

| Collection | Purpose |
|------------|---------|
| `products` | Core entity — pricing config, tier, seasonal config |
| `inventories` | Stock levels, EMA daily sales, coverage days |
| `salesevents` | Individual sale records with promotional attribution |
| `competitorprices` | Multi-competitor tracking with staleness scoring |
| `pricingrecommendations` | Append-only audit log — full input snapshot per decision |
| `mlpredictionlogs` | ML-specific audit — feature vector, model version, inference latency, guardrails fired |
| `promotionalevents` | Event lifecycle and discount configuration |
| `eventanalytics` | Pre-computed event performance metrics |
| `settings` | Singleton key-value store for global toggles |

---

## Security

- **Authentication** — Firebase Authentication issues ID tokens to the frontend; Firebase Admin SDK (`firebase-admin`) cryptographically verifies every API request via the `protect` middleware.
- **CORS** — Strict allowlist: `localhost:5173` (dev) and the `FRONTEND_URL` environment variable (production). Configured in `server.js`.
- **Secrets** — All API keys and connection strings are stored in environment variables, never in source control. `firebase-service-account.json` is in `.gitignore`.
- **Input validation** — Applied on all write endpoints at the controller level before any DB operations.

---

## Error Handling

- A **global error handler middleware** (`src/middleware/errorHandler.js`) catches all unhandled exceptions and returns a consistent `{ success: false, error: "..." }` envelope.
- All controllers use an **async wrapper** (`asyncHandler`) to eliminate `try/catch` boilerplate.
- **ML failure isolation** — if the Python process errors, times out, or returns an invalid price, `mlPredictor.js` returns `{ usedFallback: true }`. The pricing engine continues on the deterministic path. The API never returns a 500 due to ML failure.
- **MLPredictionLog writes are non-blocking** — logged with `.catch()` so an audit write failure cannot block the pricing response.
- The frontend `axiosInstance` includes a **response interceptor** that surfaces the most relevant error message.

---

## Performance

- **Parallel DB reads** — `featureExtractor.js` uses `Promise.all` to fetch product, inventory, competitors, sales, and demand signals concurrently.
- **ML inference latency** — ~150–400ms per Python child process invocation (acceptable; pricing is not a hot path).
- **EMA pre-computation** — demand velocity is calculated incrementally and cached on the `Inventory` document, avoiding expensive aggregation on every request.
- **Staleness weighting** — competitor prices older than 72 hours decay in influence rather than being dropped, reducing query overhead.
- **Event auto-expiry** — `node-cron` transitions expired events every hour, keeping active event queries fast.
- **Background scheduler** — pricing recalculations run asynchronously at a configured interval, never blocking API requests.
- **Strategic MongoDB indexing** — all collections indexed on `productId` and `createdAt` for efficient time-series and product-scoped lookups.

---

## Limitations

- **Synthetic training data** — The XGBoost model is trained on procedurally generated data (`generate_dummy_data.py`). In production, it should be retrained on real historical sales from MongoDB.
- **Per-request Python spawn** — spawning a child process per inference adds ~150–400ms latency. For high-throughput production use, replace with an ONNX runtime or a persistent FastAPI sidecar.
- **Single-model architecture** — no A/B model experimentation, no champion/challenger framework. Model upgrades require a manual retrain + deploy cycle.
- **Gemini rate limits** — the free tier is capped at 15 RPM. Under heavy load, AI explanations may fall back to a generic message; the pricing result is never affected.
- **Render cold starts** — the backend free tier spins down after 15 minutes of inactivity, causing a ~60-second delay on the first request.

---

## Roadmap

- [ ] **ONNX runtime** — replace Python child_process with `onnxruntime-node` for sub-10ms ML inference
- [ ] **Online retraining** — nightly job to retrain on real MongoDB sales history
- [ ] **Champion/Challenger** — A/B test new model versions against the current production model
- [ ] **WebSocket live updates** — push pricing decisions to the dashboard in real time
- [ ] **Bulk import/export** — CSV ingestion for competitor prices and product catalogues
- [ ] **Pluggable AI providers** — support OpenAI and Anthropic alongside Gemini
- [ ] **Unit & integration test suite** — Jest + Supertest coverage for the pricing engine and guardrails
- [ ] **Webhook notifications** — push decision events to external systems
- [ ] **Multi-currency support** — parameterise pricing in currencies beyond INR

---

## Contributing

Contributions are welcome. To contribute:

1. **Fork** the repository.
2. Create a **feature branch**: `git checkout -b feature/your-feature-name`
3. **Commit** your changes with clear, descriptive messages.
4. **Push** to your fork: `git push origin feature/your-feature-name`
5. Open a **Pull Request** describing what you changed and why.

### Development Guidelines

- Keep controllers thin — business logic belongs in `src/services/`.
- All new API endpoints must follow the existing `{ success, data }` response envelope.
- **Never change the feature vector order** in `featureExtractor.js` without simultaneously retraining the model and updating `predict.py` and `train_xgboost.py`.
- Update this README if your change adds or modifies a major feature, environment variable, or API endpoint.

---

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

---

## Acknowledgements

- [XGBoost](https://xgboost.readthedocs.io/) — gradient boosted trees for the ML pricing model
- [Google Gemini](https://deepmind.google/technologies/gemini/) — AI explanation layer
- [Firebase](https://firebase.google.com/) — Authentication and user management
- [MongoDB Atlas](https://www.mongodb.com/atlas) — free-tier cloud database
- [Render](https://render.com/) — backend hosting
- [Vercel](https://vercel.com/) — frontend hosting
