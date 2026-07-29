const PricingRecommendation = require("../models/pricingRecommendation");
const MLPredictionLog = require("../models/MLPredictionLog");
const Product = require("../models/product");
const { runPricingEngine } = require("../services/pricingEngine");
const { getModelStatus: getMLModelStatus } = require("../services/mlPredictor");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const calculatePrice = async (req, res) => {
  const uid = req.user.uid;
  const { productId, triggeredBy = "manual", referenceDate } = req.body;

  if (!productId) {
    return sendError(res, "productId is required", 400);
  }

  const refDate = referenceDate ? new Date(referenceDate) : new Date();
  if (isNaN(refDate.getTime())) {
    return sendError(
      res,
      "Invalid referenceDate — use ISO 8601 format (e.g. 2026-06-22T10:00:00Z)",
      400,
    );
  }

  // FIXED: runPricingEngine now receives ownerId to scope settings/events lookups
  const result = await runPricingEngine(productId, refDate, triggeredBy, uid);
  const { product, eventOverlay } = result;

  // SECURITY: verify the product belongs to the requesting user
  if (product.ownerId !== uid) {
    return sendError(res, "Product not found", 404);
  }

  const snap = result.inputSnapshot;
  const outcome = result.outcome;
  const signals = result.signals;

  const adjustmentStr =
    outcome.adjustmentPercent > 0
      ? `+${outcome.adjustmentPercent}`
      : String(outcome.adjustmentPercent);

  const priceDiff = outcome.recommendedPrice - snap.currentPrice;
  const headline =
    priceDiff > 0
      ? `Price increase recommended: +₹${priceDiff} (${adjustmentStr}%)`
      : priceDiff < 0
        ? `Price decrease recommended: -₹${Math.abs(priceDiff)} (${adjustmentStr}%)`
        : "No price change needed";

  return sendSuccess(res, {
    decisionId: result._id,
    product: {
      name: product.productName,
      sku: product.sku,
      category: product.category,
      tier: product.tier,
    },
    pricing: {
      currentPrice: snap.currentPrice,
      recommendedPrice: outcome.recommendedPrice,
      adjustmentPercent: outcome.adjustmentPercent,
      profitFloor: snap.costPrice
        ? parseFloat(
            (snap.costPrice * (1 + (product.targetMargin || 0.15))).toFixed(2),
          )
        : null,
      priceCeiling: parseFloat((snap.currentPrice * 1.5).toFixed(2)),
      constraintApplied: outcome.constraintApplied,
    },
    signals: {
      demand: {
        multiplier: signals.demand.multiplier,
        velocityRatio: signals.demand.velocityRatio,
        interpretation: signals.demand.interpretation,
        confidence: signals.demand.confidence,
        organicRate: signals.demand.organicRate,
        promoRate: signals.demand.promoRate,
      },
      inventory: {
        multiplier: signals.inventory.multiplier,
        coverageDays: signals.inventory.coverageDays,
        interpretation: signals.inventory.interpretation,
        confidence: signals.inventory.confidence,
      },
      competitor: {
        multiplier: signals.competitor.multiplier,
        medianPrice: signals.competitor.medianPrice,
        gapPercent: signals.competitor.gapPercent,
        interpretation: signals.competitor.interpretation,
        confidence: signals.competitor.confidence,
      },
      seasonal: {
        multiplier: signals.seasonal.multiplier,
        phase: signals.seasonal.phase,
        intensity: signals.seasonal.intensity,
        season: signals.seasonal.season || null,
      },
    },
    decision: {
      finalMultiplier: outcome.finalMultiplier,
      confidenceScore: outcome.confidenceScore,
      confidenceLevel: outcome.confidenceLevel,
      shouldApply: outcome.shouldApply,
      primaryDriver: outcome.primaryDriver,
      usedMLModel: outcome.usedMLModel,
      mlRawPrice: outcome.mlRawPrice,
    },
    eventOverlay: eventOverlay.eventApplied
      ? {
          eventApplied: true,
          eventName: eventOverlay.eventName,
          discountType: eventOverlay.discountType,
          discountValue: eventOverlay.discountValue,
          priceBeforeDiscount: eventOverlay.priceBeforeDiscount,
          priceAfterDiscount: eventOverlay.priceAfterDiscount,
          finalCustomerPrice: eventOverlay.priceAfterDiscount,
          constraintApplied: eventOverlay.constraintApplied,
        }
      : { eventApplied: false },
    explanation: {
      aiText: result.aiExplanation?.text || null,
      failed: result.aiExplanation?.failed || false,
      failureReason: result.aiExplanation?.failureReason || null,
      headline,
      primaryDriver: outcome.primaryDriver,
      whatWouldChangeThis: _whatWouldChangeThis(signals),
    },
    status: result.status,
  });
};

const applyRecommendation = async (req, res) => {
  const uid = req.user.uid;
  const { decisionId } = req.params;
  const { applyWithDiscount = false } = req.body || {};

  const decision = await PricingRecommendation.findById(decisionId);
  if (!decision) return sendError(res, "Recommendation not found", 404);

  // FIXED: verify the recommendation belongs to the authenticated user
  if (decision.ownerId !== uid) {
    return sendError(res, "Recommendation not found", 404); // 404, not 403
  }

  if (decision.status !== "PENDING") {
    return sendError(res, `Cannot apply — recommendation is already ${decision.status}`, 400);
  }

  const priceToApply =
    applyWithDiscount && decision.eventOverlay?.priceAfterDiscount
      ? decision.eventOverlay.priceAfterDiscount
      : decision.outcome.recommendedPrice;

  // Double-check product ownership before updating price
  const product = await Product.findOne({ _id: decision.productId, ownerId: uid });
  if (!product) return sendError(res, "Product not found", 404);

  await Product.findByIdAndUpdate(decision.productId, { currentPrice: priceToApply });

  decision.status = "APPLIED";
  decision.appliedAt = new Date();
  await decision.save();

  return sendSuccess(res, {
    decisionId: decision._id,
    status: "APPLIED",
    priceApplied: priceToApply,
    appliedAt: decision.appliedAt,
  });
};

const rejectRecommendation = async (req, res) => {
  const uid = req.user.uid;
  const { decisionId } = req.params;
  const { reason = "" } = req.body || {};

  const decision = await PricingRecommendation.findById(decisionId);
  if (!decision) return sendError(res, "Recommendation not found", 404);

  // FIXED: verify ownership before allowing rejection
  if (decision.ownerId !== uid) {
    return sendError(res, "Recommendation not found", 404);
  }

  if (decision.status !== "PENDING") {
    return sendError(res, `Cannot reject — recommendation is already ${decision.status}`, 400);
  }

  decision.status = "REJECTED";
  decision.rejectedReason = reason;
  await decision.save();

  return sendSuccess(res, { decisionId: decision._id, status: "REJECTED" });
};

const getRecommendations = async (req, res) => {
  const uid = req.user.uid;
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

  // FIXED: was PricingRecommendation.find(filter) — fetched ALL users' recommendations
  const filter = { ownerId: uid };
  if (req.query.status) filter.status = req.query.status.toUpperCase();

  const [records, total] = await Promise.all([
    PricingRecommendation.find(filter)
      .populate("productId", "productName sku category currentPrice")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    PricingRecommendation.countDocuments(filter),
  ]);

  return sendSuccess(res, { total, page, limit, records });
};

const getProductRecommendations = async (req, res) => {
  const uid = req.user.uid;
  const { productId } = req.params;
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

  // FIXED: verify product ownership, then filter recommendations by ownerId
  const product = await Product.findOne({ _id: productId, ownerId: uid });
  if (!product) return sendError(res, "Product not found", 404);

  const records = await PricingRecommendation.find({ productId, ownerId: uid })
    .populate('productId', 'productName sku currentPrice')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return sendSuccess(res, records);
};

function _whatWouldChangeThis(signals) {
  const bullets = [];
  const inv = signals?.inventory;
  const dem = signals?.demand;
  const comp = signals?.competitor;
  const seas = signals?.seasonal;

  if (inv?.interpretation === "LOW" || inv?.interpretation === "CRITICAL") {
    bullets.push(`If inventory coverage rises above 7 days → upward inventory pressure removed`);
  }
  if (dem?.interpretation === "RISING" || dem?.interpretation === "HIGH" || dem?.interpretation === "SURGE") {
    bullets.push(`If demand velocity falls below 1× baseline → neutral signal`);
  }
  if (comp?.gapPercent !== undefined && Math.abs(comp.gapPercent) < 5) {
    bullets.push(`If competitor undercuts by more than 5% → downward competitive pressure activates`);
  }
  if (seas?.phase === "off_season" || seas?.phase?.startsWith("disabled")) {
    bullets.push(`If seasonal pricing is enabled and product enters its peak season → upward seasonal boost applies`);
  }

  return bullets.length > 0
    ? bullets
    : ["No significant threshold changes detected near current signal values"];
}

const recalculateAll = async (req, res) => {
  const uid = req.user.uid;

  // FIXED: was Product.find({ isActive, mode: 'auto' }) — ran for ALL users' products
  const products = await Product.find({
    ownerId: uid,
    isActive: true,
    "pricingStrategy.mode": "auto",
  });

  let applied = 0, skipped = 0, failed = 0;

  for (const prod of products) {
    try {
      const result = await runPricingEngine(prod._id, new Date(), "api", uid);
      if (result.outcome?.shouldApply && result.outcome?.confidenceScore >= 0.8) {
        const priceToApply = result.eventOverlay?.eventApplied
          ? result.eventOverlay.priceAfterDiscount
          : result.outcome.recommendedPrice;
        await Product.findByIdAndUpdate(prod._id, { currentPrice: priceToApply });
        applied++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`[RecalculateAll] Failed for ${prod._id}:`, err.message);
      failed++;
    }
  }

  const processed = applied + skipped + failed;
  return sendSuccess(res, { processed, applied, skipped, failed });
};

const getRecommendationById = async (req, res) => {
  const uid = req.user.uid;

  // FIXED: was findById only — no ownership check
  const decision = await PricingRecommendation.findById(req.params.id).populate('productId');
  if (!decision) return sendError(res, "Recommendation not found", 404);

  if (decision.ownerId !== uid) {
    return sendError(res, "Recommendation not found", 404);
  }

  const product = decision.productId;
  const snap = decision.inputSnapshot;
  const outcome = decision.outcome;
  const signals = decision.signals;
  const eventOverlay = decision.eventOverlay || {};

  const adjustmentStr =
    outcome.adjustmentPercent > 0
      ? `+${outcome.adjustmentPercent}`
      : String(outcome.adjustmentPercent);

  const priceDiff = outcome.recommendedPrice - snap.currentPrice;
  const headline =
    priceDiff > 0
      ? `Price increase recommended: +₹${priceDiff} (${adjustmentStr}%)`
      : priceDiff < 0
        ? `Price decrease recommended: -₹${Math.abs(priceDiff)} (${adjustmentStr}%)`
        : "No price change needed";

  return sendSuccess(res, {
    decisionId: decision._id,
    product: {
      _id: product._id,
      name: product.productName,
      sku: product.sku,
      category: product.category,
      tier: product.tier,
    },
    pricing: {
      currentPrice: snap.currentPrice,
      recommendedPrice: outcome.recommendedPrice,
      adjustmentPercent: outcome.adjustmentPercent,
      profitFloor: snap.costPrice
        ? parseFloat((snap.costPrice * (1 + (product.targetMargin || 0.15))).toFixed(2))
        : null,
      priceCeiling: parseFloat((snap.currentPrice * 1.5).toFixed(2)),
      constraintApplied: outcome.constraintApplied,
    },
    signals: {
      demand: signals.demand,
      inventory: signals.inventory,
      competitor: signals.competitor,
      seasonal: signals.seasonal,
    },
    decision: {
      finalMultiplier: outcome.finalMultiplier || outcome.rawMultiplier,
      confidenceScore: outcome.confidenceScore,
      confidenceLevel: outcome.confidenceLevel,
      shouldApply: outcome.shouldApply,
      primaryDriver: outcome.primaryDriver,
      usedMLModel: outcome.usedMLModel,
      mlRawPrice: outcome.mlRawPrice,
    },
    eventOverlay: eventOverlay.eventName
      ? {
          eventApplied: true,
          eventName: eventOverlay.eventName,
          discountType: eventOverlay.discountType,
          discountValue: eventOverlay.discountValue,
          priceBeforeDiscount: eventOverlay.priceBeforeDiscount,
          priceAfterDiscount: eventOverlay.priceAfterDiscount,
          finalCustomerPrice: eventOverlay.priceAfterDiscount,
          constraintApplied: eventOverlay.constraintApplied,
        }
      : { eventApplied: false },
    explanation: {
      aiText: decision.aiExplanation?.text || null,
      failed: decision.aiExplanation?.failed || false,
      failureReason: decision.aiExplanation?.failureReason || null,
      headline,
      primaryDriver: outcome.primaryDriver,
      whatWouldChangeThis: _whatWouldChangeThis(signals),
    },
    status: decision.status,
  });
};

// ══════════════════════════════════════════════════════════════════════════════
// NEW: ML-SPECIFIC ENDPOINTS (Phase 8 of Hybrid Upgrade)
// All existing endpoints above are UNCHANGED.
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/pricing/model-status
 * Returns the current health and metadata of the XGBoost model.
 * Used by the frontend ML Insights panel to show model status badge.
 *
 * Response: { loaded, version, modelFileExists, scriptFileExists }
 */
const getModelStatus = async (req, res) => {
  const status = getMLModelStatus();
  return sendSuccess(res, {
    loaded: status.loaded,
    version: status.version,
    mode: status.loaded ? "hybrid_xgboost" : "deterministic_fallback",
    modelFileExists: status.modelFileExists,
    scriptFileExists: status.scriptFileExists,
    message: status.loaded
      ? `XGBoost model v${status.version} is active — Hybrid pricing enabled`
      : "XGBoost model not loaded — using deterministic fallback mode",
  });
};

/**
 * GET /api/v1/pricing/prediction-logs
 * Returns paginated ML prediction logs for the authenticated user.
 * Shows raw ML price, final price, and which guardrails fired.
 *
 * Query params: limit, page, productId (optional filter)
 */
const getPredictionLogs = async (req, res) => {
  const uid = req.user.uid;
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

  const filter = { ownerId: uid };
  if (req.query.usedFallback !== undefined) {
    filter.usedFallback = req.query.usedFallback === "true";
  }

  const [records, total] = await Promise.all([
    MLPredictionLog.find(filter)
      .populate("productId", "productName sku category currentPrice")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("-featureVector") // exclude raw vector from list view (too verbose)
      .lean(),
    MLPredictionLog.countDocuments(filter),
  ]);

  return sendSuccess(res, { total, page, limit, records });
};

/**
 * GET /api/v1/pricing/prediction-logs/:productId
 * Returns ML prediction logs for a specific product.
 * Used by the ML Insights panel on the PricingPage.
 */
const getProductPredictionLogs = async (req, res) => {
  const uid = req.user.uid;
  const { productId } = req.params;
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);

  // Verify product ownership
  // PERF: Select only fields used in the response — avoids fetching the full product document.
  const product = await Product.findOne({ _id: productId, ownerId: uid })
    .select('_id productName sku');
  if (!product) return sendError(res, "Product not found", 404);

  const logs = await MLPredictionLog.find({ productId, ownerId: uid })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("-featureVector") // exclude raw vector from product view
    .lean();

  // PERF FIX: Use $group aggregation instead of loading all logs into memory.
  // Previously: MLPredictionLog.find() with no limit → O(N) memory for N logs.
  // Now: server-side aggregation returns only 4 numbers regardless of collection size.
  const [aggResult] = await MLPredictionLog.aggregate([
    { $match: { productId: product._id, ownerId: uid } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        mlCount: { $sum: { $cond: [{ $eq: ["$usedFallback", false] }, 1, 0] } },
        fallbackCount: { $sum: { $cond: ["$usedFallback", 1, 0] } },
        avgLatency: {
          $avg: {
            $cond: [{ $eq: ["$usedFallback", false] }, "$predictionLatencyMs", null],
          },
        },
        avgPriceShift: {
          $avg: {
            $cond: [{ $eq: ["$usedFallback", false] }, "$priceShift", null],
          },
        },
      },
    },
  ]);

  const stats = aggResult
    ? {
        totalPredictions: aggResult.total,
        mlPredictions: aggResult.mlCount,
        fallbackPredictions: aggResult.fallbackCount,
        avgPredictionLatencyMs: aggResult.avgLatency ? Math.round(aggResult.avgLatency) : null,
        avgGuardrailPriceShift: aggResult.avgPriceShift
          ? parseFloat(aggResult.avgPriceShift.toFixed(2))
          : null,
      }
    : {
        totalPredictions: 0,
        mlPredictions: 0,
        fallbackPredictions: 0,
        avgPredictionLatencyMs: null,
        avgGuardrailPriceShift: null,
      };

  return sendSuccess(res, {
    product: { _id: product._id, name: product.productName, sku: product.sku },
    stats,
    logs,
  });
};

module.exports = {
  calculatePrice,
  applyRecommendation,
  rejectRecommendation,
  getRecommendations,
  getProductRecommendations,
  recalculateAll,
  getRecommendationById,
  // NEW: ML endpoints
  getModelStatus,
  getPredictionLogs,
  getProductPredictionLogs,
};
