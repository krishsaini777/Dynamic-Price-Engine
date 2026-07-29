const mongoose = require("mongoose");

const pricingRecommendationSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    // OWNER — Firebase UID for fast per-user filtering
    ownerId: { type: String, required: true },

    inputSnapshot: {
      currentPrice: { type: Number },
      costPrice: { type: Number },
      basePrice: { type: Number },
      availableQuantity: { type: Number },
      emaDailySales: { type: Number },
      coverageDays: { type: Number },
      referenceDate: { type: Date },
      competitorPrices: [
        { competitorName: String, price: Number, recordedAt: Date },
      ],
    },

    signals: {
      demand: {
        multiplier: { type: Number },
        confidence: { type: Number },
        velocityRatio: { type: Number },
        interpretation: { type: String },
        organicRate: { type: Number },
        promoRate: { type: Number },
      },
      inventory: {
        multiplier: { type: Number },
        confidence: { type: Number },
        coverageDays: { type: Number },
        interpretation: { type: String },
      },
      competitor: {
        multiplier: { type: Number },
        confidence: { type: Number },
        medianPrice: { type: Number },
        gapPercent: { type: Number },
        interpretation: { type: String },
      },
      seasonal: {
        multiplier: { type: Number },
        phase: { type: String },
        intensity: { type: Number },
        season: { type: String },
      },
    },

    outcome: {
      rawMultiplier: { type: Number },
      finalMultiplier: { type: Number },
      recommendedPrice: { type: Number, required: true },
      adjustmentPercent: { type: Number },
      confidenceScore: { type: Number },
      confidenceLevel: { type: String, enum: ["HIGH", "MEDIUM", "LOW"] },
      shouldApply: { type: Boolean },
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
      },
      primaryDriver: { type: String },
      // ── ML-specific outcome fields (added in hybrid upgrade) ────────────────
      // Without these declarations, Mongoose strict mode silently drops them.
      mlRawPrice: { type: Number, default: null },    // raw XGBoost prediction before guardrails
      usedMLModel: { type: Boolean, default: false },  // true if XGBoost ran successfully
      guardrailsApplied: { type: mongoose.Schema.Types.Mixed, default: [] }, // which guardrails fired
    },

    eventOverlay: {
      eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PromotionalEvent",
        default: null,
      },
      eventName: { type: String, default: null },
      discountType: { type: String, default: null },
      discountValue: { type: Number, default: null },
      priceBeforeDiscount: { type: Number, default: null },
      priceAfterDiscount: { type: Number, default: null },
      constraintApplied: { type: String, default: null },
    },

    aiExplanation: {
      text: { type: String, default: null },
      model: { type: String, default: "gemini-2.0-flash" },
      failed: { type: Boolean, default: false },
      failureReason: { type: String, default: null },
      generatedAt: { type: Date, default: null },
    },

    status: {
      type: String,
      enum: ["PENDING", "APPLIED", "REJECTED", "EXPIRED"],
      default: "PENDING",
    },
    appliedAt: { type: Date, default: null },
    rejectedReason: { type: String, default: null },
    triggeredBy: {
      type: String,
      enum: ["manual", "scheduler", "api"],
      default: "manual",
    },
  },
  { timestamps: true },
);

pricingRecommendationSchema.index({ ownerId: 1, createdAt: -1 });
pricingRecommendationSchema.index({ productId: 1, createdAt: -1 });
pricingRecommendationSchema.index({ status: 1 });
pricingRecommendationSchema.index({ "outcome.confidenceScore": -1 });
pricingRecommendationSchema.index({ createdAt: -1 });

module.exports = mongoose.model(
  "PricingRecommendation",
  pricingRecommendationSchema,
);
