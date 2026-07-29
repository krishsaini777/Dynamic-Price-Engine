/**
 * MLPredictionLog.js — Mongoose model for ML prediction audit records.
 *
 * RESPONSIBILITY: Stores every XGBoost prediction alongside the final
 * guardrail-approved price, enabling:
 *  1. Model accuracy monitoring  (how far off was raw ML from final price?)
 *  2. Guardrail trigger analytics (which rules fire most frequently?)
 *  3. Retraining data collection (log actual sales outcome here later)
 *  4. Interview demonstration    (show the diff between AI and business rules)
 *
 * SCHEMA DESIGN DECISIONS:
 *  - featureVector stored as [Number] for direct Pandas/numpy ingestion
 *  - guardrailsApplied is Mixed to allow flexible per-rule log objects
 *  - TTL index auto-deletes logs after 90 days (same as SalesEvent)
 *    → prevents MongoDB free-tier storage exhaustion
 *  - ownerId indexed for per-user analytics queries
 *
 * COLLECTION NAME: mlpredictionlogs
 */

"use strict";

const mongoose = require("mongoose");

const mlPredictionLogSchema = new mongoose.Schema(
  {
    // ── Scoping ──────────────────────────────────────────────────────────────
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    ownerId: {
      type: String,
      required: true,
      index: true,
    },
    pricingRecommendationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PricingRecommendation",
      default: null,
    },

    // ── ML Prediction Input ───────────────────────────────────────────────────
    featureVector: {
      type: [Number],
      required: true,
      validate: {
        validator: (v) => v.length === 19,
        message: "featureVector must have exactly 19 elements",
      },
    },
    featureMeta: {
      type: mongoose.Schema.Types.Mixed, // labelled key-value for human readability
      default: {},
    },

    // ── ML Prediction Output ─────────────────────────────────────────────────
    mlRawPrice: {
      type: Number,
      default: null, // null if fallback was used
    },
    usedFallback: {
      type: Boolean,
      default: false,
    },
    fallbackReason: {
      type: String,
      default: null, // populated when usedFallback=true
    },
    modelVersion: {
      type: String,
      default: "none",
    },
    predictionLatencyMs: {
      type: Number,
      default: null,
    },

    // ── Guardrails Applied ────────────────────────────────────────────────────
    guardrailsApplied: {
      type: mongoose.Schema.Types.Mixed, // array of { rule, triggered, detail, before, after }
      default: [],
    },
    constraintApplied: {
      type: String,
      enum: [
        "PROFIT_FLOOR",
        "CEILING",
        "STABILITY",
        "COMPETITOR_CAP",
        "INVENTORY_RULE",
        "MINIMUM_CHANGE",
        "NONE",
      ],
      default: "NONE",
    },

    // ── Final Output ─────────────────────────────────────────────────────────
    finalPrice: {
      type: Number,
      required: true,
    },
    priceShift: {
      type: Number, // finalPrice - mlRawPrice (how much did guardrails change the ML output?)
      default: null,
    },
    triggeredBy: {
      type: String,
      enum: ["manual", "scheduler", "api"],
      default: "manual",
    },
  },
  { timestamps: true },
);

// ── Indexes ───────────────────────────────────────────────────────────────────
mlPredictionLogSchema.index({ productId: 1, createdAt: -1 }); // per-product history
mlPredictionLogSchema.index({ ownerId: 1, createdAt: -1 });   // per-user history
mlPredictionLogSchema.index({ usedFallback: 1 });              // filter ML vs fallback
mlPredictionLogSchema.index({ constraintApplied: 1 });         // guardrail analytics

// TTL: auto-delete logs after 90 days to prevent free-tier storage exhaustion
mlPredictionLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 7776000 }, // 90 days
);

module.exports = mongoose.model("MLPredictionLog", mlPredictionLogSchema);
