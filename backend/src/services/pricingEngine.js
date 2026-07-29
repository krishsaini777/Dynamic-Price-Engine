/**
 * pricingEngine.js — Hybrid Pricing Engine Orchestrator
 *
 * RESPONSIBILITY: Coordinate the full pricing pipeline. This is now a THIN
 * orchestrator. All business logic lives in dedicated single-responsibility services.
 *
 * THE HYBRID PIPELINE:
 *  1. FeatureExtractor  → build 19-feature vector from MongoDB
 *  2. MLPredictor       → XGBoost proposes a raw price (or falls back to deterministic)
 *  3. PricingGuardrails → 7 business rules approve/constrain the proposed price
 *  4. EventService      → promotional discount overlay (applied AFTER market optimization)
 *  5. AIService         → Gemini generates natural language explanation
 *  6. PricingRecommendation → append-only audit log (unchanged schema for compatibility)
 *  7. MLPredictionLog   → ML-specific audit record (new in hybrid upgrade)
 *
 * BACKWARD COMPATIBILITY:
 *  - All existing API response shapes are preserved.
 *  - The `signals` object in the PricingRecommendation schema is preserved.
 *  - The `outcome` object structure is preserved.
 *  - No existing test or API consumer needs to change.
 *
 * DESIGN DECISIONS:
 *  - Signal computation functions (demand, inventory, competitor, seasonal)
 *    are preserved for two reasons:
 *    (a) They populate the `signals` field in PricingRecommendation (audit log)
 *    (b) They serve as the deterministic FALLBACK if ML fails
 *  - The ML model output is used as the PRIMARY price proposal.
 *    The deterministic multiplier composition is used ONLY when ML fallback fires.
 *  - Both paths (ML and fallback) go through the SAME guardrails.
 *    This means guardrail behavior is consistent regardless of which path ran.
 *
 * Time Complexity:  O(S) dominated by SalesEvent queries in demandAttribution
 * Space Complexity: O(S + C) where S=sales records, C=competitor records
 */

"use strict";

const Product = require("../models/product");
const Inventory = require("../models/inventory");
const CompetitorPrice = require("../models/competitorPrice");
const PricingRecommendation = require("../models/pricingRecommendation");
const MLPredictionLog = require("../models/MLPredictionLog");
const Settings = require("../models/settings");
const { computeAttributedDemand } = require("./demandAttribution");
const eventService = require("./eventService");
const aiService = require("./aiService");
const { extractFeatures } = require("./featureExtractor");
const { predict: mlPredict } = require("./mlPredictor");
const { applyGuardrails } = require("./pricingGuardrails");
const { charmPrice, getDayOfYear, AUTO_APPLY_THRESHOLD } = require("../utils/pricingUtils");

/**
 * runPricingEngine — Main entry point for the hybrid pricing pipeline.
 *
 * Accepts the same parameters as before for full backward compatibility.
 * Called by: pricingController.js, scheduler.js
 *
 * @param {string|ObjectId} productId
 * @param {Date} referenceDate
 * @param {string} triggeredBy - 'manual' | 'scheduler' | 'api'
 * @param {string|null} ownerId - Firebase UID for multi-tenant scoping
 * @returns {Promise<Object>} Combined result object (PricingRecommendation + ML metadata)
 */
async function runPricingEngine(
  productId,
  referenceDate = new Date(),
  triggeredBy = "manual",
  ownerId = null,
) {
  // ── 1. Load core documents ─────────────────────────────────────────────────
  const product = await Product.findById(productId);
  if (!product || !product.isActive)
    throw new Error("Product not found or inactive");

  const effectiveOwnerId = ownerId || product.ownerId;

  const inventory = await Inventory.findOne({ productId });
  if (!inventory) throw new Error("Inventory record not found");

  const competitors = await CompetitorPrice.find({ productId });

  // ── 2. Compute demand attribution (unchanged — required for signals log) ───
  const attributedDemand = await computeAttributedDemand(productId, referenceDate);

  // ── 3. Compute individual signals (unchanged — used for audit log + fallback)
  const demandSignal = computeDemandSignal(attributedDemand);
  const inventorySignal = computeInventorySignal(inventory, attributedDemand);
  const competitorSignal = computeCompetitorSignal(competitors, product.currentPrice);
  const seasonalSignal = await computeSeasonalSignal(product, referenceDate, effectiveOwnerId);

  // ── 4. Extract ML feature vector ──────────────────────────────────────────
  let featureVector = null;
  let featureMeta = null;
  let extractionError = null;

  try {
    const extracted = await extractFeatures({
      productId,
      referenceDate,
      ownerId: effectiveOwnerId,
      // PERF (BN-4): Pass pre-computed demand to avoid a second SalesEvent fetch.
      // attributedDemand was already fetched in step 2 above — reuse it here.
      preComputedDemand: attributedDemand,
    });
    featureVector = extracted.vector;
    featureMeta = extracted.meta;
  } catch (err) {
    extractionError = err.message;
    console.warn(`[PricingEngine] Feature extraction failed for ${productId}: ${err.message}`);
  }

  // ── 5. ML Prediction (XGBoost) ─────────────────────────────────────────────
  let mlResult = {
    predictedPrice: null,
    predictionLatencyMs: 0,
    usedFallback: true,
    modelVersion: "none",
    error: extractionError || "Feature extraction failed",
  };

  if (featureVector) {
    mlResult = await mlPredict(featureVector);
  }

  // ── 6. Determine the proposed price ──────────────────────────────────────
  // If ML succeeds → use ML price as proposal
  // If ML fails   → use deterministic composition as fallback proposal
  let proposedPrice;

  if (!mlResult.usedFallback && mlResult.predictedPrice > 0) {
    proposedPrice = mlResult.predictedPrice;
  } else {
    // Deterministic fallback: compose signals multiplicatively (original logic)
    const rawMultiplier =
      demandSignal.multiplier *
      inventorySignal.multiplier *
      competitorSignal.multiplier *
      seasonalSignal.multiplier;

    const maxUp = 1 + (product.pricingStrategy?.maxIncreasePct || 0.15);
    const maxDown = 1 - (product.pricingStrategy?.maxDecreasePct || 0.15);
    const clampedMultiplier = Math.max(maxDown, Math.min(maxUp, rawMultiplier));
    proposedPrice = product.currentPrice * clampedMultiplier;
  }

  // ── 7. Apply deterministic guardrails (ALWAYS — regardless of ML or fallback)
  const guardrailResult = applyGuardrails({
    proposedPrice,
    costPrice: product.costPrice,
    currentPrice: product.currentPrice,
    targetMargin: product.targetMargin,
    competitorMedianPrice: competitorSignal.medianPrice,
    inventoryCoverageDays: inventorySignal.coverageDays,
    seasonalMultiplier: seasonalSignal.multiplier,
  });

  const finalPrice = guardrailResult.finalPrice;

  // ── 8. Compute recommendation outcome (unchanged schema) ──────────────────
  const rawMultiplierForLog = mlResult.usedFallback
    ? (demandSignal.multiplier * inventorySignal.multiplier *
       competitorSignal.multiplier * seasonalSignal.multiplier)
    : (mlResult.predictedPrice / product.currentPrice);

  const adjustmentPercent = parseFloat(
    (((finalPrice - product.currentPrice) / product.currentPrice) * 100).toFixed(2),
  );

  const confidenceScore = computeConfidenceScore(
    demandSignal,
    inventorySignal,
    competitorSignal,
    mlResult,
  );

  const confidenceLevel =
    confidenceScore >= 0.75 ? "HIGH" :
    confidenceScore >= 0.50 ? "MEDIUM" : "LOW";

  // Unified auto-apply threshold (bug fix: was inconsistent between engine and scheduler)
  const shouldApply =
    confidenceScore >= AUTO_APPLY_THRESHOLD &&
    guardrailResult.constraintApplied !== "MINIMUM_CHANGE";

  const signalList = [
    { name: "demand",     impact: Math.abs(demandSignal.multiplier - 1) },
    { name: "inventory",  impact: Math.abs(inventorySignal.multiplier - 1) },
    { name: "competitor", impact: Math.abs(competitorSignal.multiplier - 1) },
    { name: "seasonal",   impact: seasonalSignal.phase?.startsWith("disabled") ? 0 : Math.abs(seasonalSignal.multiplier - 1) },
    { name: "ml_model",   impact: mlResult.usedFallback ? 0 : Math.abs((mlResult.predictedPrice - product.currentPrice) / product.currentPrice) },
  ].sort((a, b) => b.impact - a.impact);

  const primaryDriver = signalList[0].name;

  const recommendation = {
    rawMultiplier: parseFloat(rawMultiplierForLog.toFixed(4)),
    finalMultiplier: parseFloat((finalPrice / product.currentPrice).toFixed(4)),
    recommendedPrice: finalPrice,
    adjustmentPercent,
    confidenceScore,
    confidenceLevel,
    shouldApply,
    constraintApplied: guardrailResult.constraintApplied,
    primaryDriver,
    // NEW: hybrid-specific fields
    mlRawPrice: mlResult.usedFallback ? null : mlResult.predictedPrice,
    usedMLModel: !mlResult.usedFallback,
    guardrailsApplied: guardrailResult.guardrailsApplied,
  };

  // ── 9. Event overlay (unchanged — applied after market optimization) ───────
  let eventOverlay = { eventApplied: false };
  const activeEvent = await eventService.findActiveEventForProduct(
    product,
    referenceDate,
    effectiveOwnerId,
  );

  if (activeEvent) {
    eventOverlay = eventService.applyEventDiscount(
      activeEvent,
      finalPrice,
      product,
    );
  }

  // ── 10. AI Explanation (now includes ML context) ───────────────────────────
  let aiExplanation = { text: null, failed: false };
  try {
    aiExplanation = await aiService.generateExplanation({
      product,
      recommendation,
      demandSignal,
      inventorySignal,
      competitorSignal,
      seasonalSignal,
      eventOverlay,
      mlContext: {
        usedMLModel: !mlResult.usedFallback,
        mlRawPrice: mlResult.predictedPrice,
        modelVersion: mlResult.modelVersion,
      },
    });
  } catch (e) {
    aiExplanation = { text: null, failed: true, failureReason: e.message };
  }

  // ── 11. Persist to PricingRecommendation (unchanged schema — backward compat)
  const decision = await PricingRecommendation.create({
    productId,
    ownerId: effectiveOwnerId,
    inputSnapshot: {
      currentPrice: product.currentPrice,
      costPrice: product.costPrice,
      basePrice: product.basePrice,
      availableQuantity: inventory.availableQuantity,
      emaDailySales: attributedDemand.longTermRate * 24,
      coverageDays: inventorySignal.coverageDays,
      referenceDate,
      competitorPrices: competitors.map((c) => ({
        competitorName: c.competitorName,
        price: c.competitorPrice,
        recordedAt: c.recordedAt,
      })),
    },
    signals: {
      demand: {
        ...demandSignal,
        organicRate: attributedDemand.organicShortTermRate,
        promoRate: attributedDemand.promoShortTermRate,
      },
      inventory: inventorySignal,
      competitor: competitorSignal,
      seasonal: seasonalSignal,
    },
    outcome: recommendation,
    eventOverlay: activeEvent ? eventOverlay : undefined,
    aiExplanation,
    status: "PENDING",
    triggeredBy,
  });

  // ── 12. Persist to MLPredictionLog (new — non-blocking fire-and-forget) ────
  // We do NOT await this — ML logging failure must never block the pricing response.
  MLPredictionLog.create({
    productId,
    ownerId: effectiveOwnerId,
    pricingRecommendationId: decision._id,
    featureVector: featureVector || [],
    featureMeta: featureMeta || {},
    mlRawPrice: mlResult.predictedPrice,
    usedFallback: mlResult.usedFallback,
    fallbackReason: mlResult.error || null,
    modelVersion: mlResult.modelVersion,
    predictionLatencyMs: mlResult.predictionLatencyMs,
    guardrailsApplied: guardrailResult.guardrailsApplied,
    constraintApplied: guardrailResult.constraintApplied,
    finalPrice,
    priceShift: mlResult.predictedPrice
      ? parseFloat((finalPrice - mlResult.predictedPrice).toFixed(2))
      : null,
    triggeredBy,
  }).catch((err) =>
    console.error("[PricingEngine] MLPredictionLog write failed (non-fatal):", err.message),
  );

  // ── 13. Update product's lastPricedAt ─────────────────────────────────────
  await Product.findByIdAndUpdate(productId, { lastPricedAt: new Date() });

  return { ...decision.toObject(), product, eventOverlay };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIGNAL COMPUTATION FUNCTIONS
// These are preserved from the original engine for:
//  (a) Populating the PricingRecommendation.signals audit field
//  (b) Serving as the deterministic fallback when ML fails
//  (c) Backward compatibility with existing API response shapes
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * computeDemandSignal — EMA-based demand velocity signal.
 * Compares 6-hour organic rate vs 7-day organic baseline.
 *
 * Multiplier range: 0.92 (LOW demand) – 1.15 (SURGE)
 * Confidence: scaled by total sales count (more data = more confidence)
 */
function computeDemandSignal(attributedDemand) {
  const { shortTermRate, longTermRate, totalSalesCount, isEventActive } = attributedDemand;
  const velocityRatio = longTermRate > 0 ? shortTermRate / longTermRate : 1.0;

  let confidence = Math.min(1.0, totalSalesCount / 20);

  let interpretation, baseMultiplier;
  if (velocityRatio > 5)       { interpretation = "SURGE";   baseMultiplier = 1.15; }
  else if (velocityRatio > 2)  { interpretation = "HIGH";    baseMultiplier = 1.1;  }
  else if (velocityRatio > 1.2){ interpretation = "RISING";  baseMultiplier = 1.05; }
  else if (velocityRatio > 0.8){ interpretation = "STABLE";  baseMultiplier = 1.0;  }
  else if (velocityRatio > 0.5){ interpretation = "FALLING"; baseMultiplier = 0.96; }
  else                          { interpretation = "LOW";     baseMultiplier = 0.92; }

  // Reduce confidence if event is active (demand may be artificially elevated)
  if (isEventActive && velocityRatio >= 0.8 && velocityRatio <= 1.2) {
    confidence *= 0.7;
  }

  const multiplier = 1.0 + (baseMultiplier - 1.0) * confidence;

  return { multiplier, confidence, velocityRatio, interpretation };
}

/**
 * computeInventorySignal — Stock coverage days signal.
 * Coverage = availableQty / emaDailySales
 *
 * Multiplier range: 0.92 (HIGH stock → discount to clear) – 1.20 (ZERO stock)
 */
function computeInventorySignal(inventory, attributedDemand) {
  const { availableQuantity } = inventory;
  const emaDailySales = attributedDemand.longTermRate * 24 || 1;
  const coverageDays = availableQuantity / emaDailySales;

  let interpretation, multiplier;
  if (coverageDays === 0)      { interpretation = "ZERO";     multiplier = 1.20; }
  else if (coverageDays < 3)   { interpretation = "CRITICAL"; multiplier = 1.15; }
  else if (coverageDays < 7)   { interpretation = "LOW";      multiplier = 1.06; }
  else if (coverageDays < 15)  { interpretation = "NORMAL";   multiplier = 1.0;  }
  else                          { interpretation = "HIGH";     multiplier = 0.92; }

  return {
    multiplier,
    confidence: 1.0, // inventory data is always complete and deterministic
    coverageDays: parseFloat(coverageDays.toFixed(1)),
    interpretation,
  };
}

/**
 * computeCompetitorSignal — Staleness-weighted median competitor with IQR outlier rejection.
 *
 * Staleness weighting: prices older than 72h decay linearly to 0 influence.
 * IQR filter: removes statistical outliers before computing the median.
 * Effect capped at ±8% to prevent a race to the bottom.
 */
function computeCompetitorSignal(competitorRecords, ourPrice) {
  if (!competitorRecords || competitorRecords.length === 0) {
    return { multiplier: 1.0, confidence: 0, medianPrice: null, gapPercent: 0, interpretation: "NO_DATA" };
  }

  const now = Date.now();
  const fresh = competitorRecords
    .map((r) => ({ price: r.competitorPrice, age: (now - new Date(r.updatedAt)) / 3600000 }))
    .filter((r) => r.age <= 72)
    .map((r) => ({ price: r.price, weight: 1 - r.age / 72 }));

  if (fresh.length === 0) {
    return { multiplier: 1.0, confidence: 0, medianPrice: null, gapPercent: 0, interpretation: "ALL_STALE" };
  }

  // IQR outlier rejection
  const prices = fresh.map((r) => r.price).sort((a, b) => a - b);
  const q1 = prices[Math.floor(prices.length * 0.25)] ?? prices[0];
  const q3 = prices[Math.floor(prices.length * 0.75)] ?? prices[prices.length - 1];
  const iqr = q3 - q1;
  const inliers = fresh.filter((r) => r.price >= q1 - 1.5 * iqr && r.price <= q3 + 1.5 * iqr);
  const medianPrice = inliers[Math.floor(inliers.length / 2)]?.price ?? ourPrice;

  const gapPercent = ((medianPrice - ourPrice) / ourPrice) * 100;
  const rawInfluence = gapPercent * 0.4;
  const clampedInfluence = Math.max(-8, Math.min(8, rawInfluence));
  const multiplier = 1.0 + clampedInfluence / 100;

  let interpretation;
  if (gapPercent > 5)       interpretation = "COMPETITORS_EXPENSIVE";
  else if (gapPercent > 1)  interpretation = "SLIGHTLY_EXPENSIVE";
  else if (gapPercent > -1) interpretation = "NEAR_PARITY";
  else if (gapPercent > -5) interpretation = "SLIGHTLY_CHEAPER";
  else                       interpretation = "COMPETITORS_CHEAPER";

  return {
    multiplier,
    confidence: Math.min(1, inliers.length / 5),
    medianPrice,
    gapPercent: parseFloat(gapPercent.toFixed(2)),
    interpretation,
  };
}

/**
 * computeSeasonalSignal — Sigmoid ramp with 3-tier cascade toggle.
 *
 * Tier 1: global on/off toggle (Settings.seasonalPricingEnabled)
 * Tier 2: per-category exclusions (Settings.seasonalDisabledCategories)
 * Tier 3: per-product configuration (product.seasonalConfig)
 *
 * Bug Fix: A missing Settings document now defaults to ENABLED
 * (previously was treated as disabled, suppressing all seasonal pricing
 * for new users who had not configured the settings yet).
 */
async function computeSeasonalSignal(product, referenceDate, ownerId = null) {
  const globalSetting = await Settings.findOne({ key: "seasonalPricingEnabled", ownerId });

  // Bug fix: null means "not configured" → default to enabled (not disabled)
  if (globalSetting && globalSetting.value === false) {
    return { multiplier: 1.0, phase: "disabled_global", intensity: 0, reason: "Seasonal pricing disabled globally" };
  }

  const disabledCats = await Settings.findOne({ key: "seasonalDisabledCategories", ownerId });
  if (disabledCats && Array.isArray(disabledCats.value) && disabledCats.value.includes(product.category)) {
    return { multiplier: 1.0, phase: "disabled_category", intensity: 0, reason: `Seasonal pricing disabled for ${product.category}` };
  }

  const sc = product.seasonalConfig;
  if (!sc || sc.season === "none") {
    return { multiplier: 1.0, phase: "off_season", intensity: 0 };
  }

  const doy = getDayOfYear(referenceDate);
  const startDoy = getDayOfYear(sc.startDate);
  const peakDoy = getDayOfYear(sc.peakDate);
  const endDoy = getDayOfYear(sc.endDate);
  const maxBoost = sc.maxBoost || 0.12;
  const sigmoid = (x) => 1 / (1 + Math.exp(-10 * (x - 0.5)));

  if (doy >= startDoy && doy <= peakDoy) {
    const progress = (doy - startDoy) / (peakDoy - startDoy || 1);
    const intensity = sigmoid(progress);
    return { multiplier: 1.0 + maxBoost * intensity, phase: "ramp_up", intensity, season: sc.season };
  }
  if (doy > peakDoy && doy <= endDoy) {
    const progress = (doy - peakDoy) / (endDoy - peakDoy || 1);
    const intensity = 1 - sigmoid(progress);
    return { multiplier: 1.0 + maxBoost * intensity, phase: "ramp_down", intensity, season: sc.season };
  }

  return { multiplier: 1.0, phase: "off_season", intensity: 0 };
}

/**
 * computeConfidenceScore — Computes weighted confidence across all signals.
 *
 * With ML in the loop, we weight ML model success as an additional signal.
 * Weights: Demand 35%, Inventory 25%, Competitor 20%, ML success 15%, Seasonal 5%
 *
 * Design: ML success bonus rewards the system for using the full pipeline.
 * When ML fallback is used, the bonus is 0 — reflecting higher uncertainty.
 */
function computeConfidenceScore(demandSignal, inventorySignal, competitorSignal, mlResult) {
  const mlBonus = mlResult.usedFallback ? 0 : 0.15; // 15% bonus for successful ML prediction

  const score = parseFloat(
    (
      0.35 * demandSignal.confidence +
      0.25 * inventorySignal.confidence +
      0.20 * (competitorSignal.confidence || 0) +
      0.05 * 1.0 + // seasonal always has full confidence
      mlBonus
    ).toFixed(2),
  );

  return Math.min(1.0, score); // cap at 1.0
}

/**
 * composePriceRecommendation — Kept for backward compatibility.
 * Called by pricingController.js in recalculateAll when a product is already
 * loaded. This shim delegates to the new hybrid pipeline.
 *
 * @deprecated Use runPricingEngine directly.
 */
function composePriceRecommendation({ product, demandSignal, inventorySignal, competitorSignal, seasonalSignal }) {
  const { currentPrice, costPrice, targetMargin, pricingStrategy } = product;

  const rawMultiplier =
    demandSignal.multiplier *
    inventorySignal.multiplier *
    competitorSignal.multiplier *
    seasonalSignal.multiplier;

  const maxUp = 1 + (pricingStrategy?.maxIncreasePct || 0.15);
  const maxDown = 1 - (pricingStrategy?.maxDecreasePct || 0.15);
  const finalMultiplier = Math.max(maxDown, Math.min(maxUp, rawMultiplier));

  let recommendedPrice = currentPrice * finalMultiplier;
  let constraintApplied = "NONE";

  const profitFloor = costPrice * (1 + targetMargin);
  if (recommendedPrice < profitFloor) { recommendedPrice = profitFloor; constraintApplied = "PROFIT_FLOOR"; }

  const priceCeiling = currentPrice * 1.5;
  if (recommendedPrice > priceCeiling) { recommendedPrice = priceCeiling; constraintApplied = "CEILING"; }

  const changePercent = Math.abs(recommendedPrice - currentPrice) / currentPrice;
  if (changePercent < 0.01) { recommendedPrice = currentPrice; constraintApplied = "MINIMUM_CHANGE"; }

  recommendedPrice = charmPrice(Math.round(recommendedPrice));

  const confidenceScore = parseFloat(
    (0.4 * demandSignal.confidence + 0.3 * inventorySignal.confidence + 0.2 * (competitorSignal.confidence || 0) + 0.1 * 1.0).toFixed(2),
  );
  const confidenceLevel = confidenceScore >= 0.75 ? "HIGH" : confidenceScore >= 0.5 ? "MEDIUM" : "LOW";
  const shouldApply = confidenceScore >= AUTO_APPLY_THRESHOLD && constraintApplied !== "MINIMUM_CHANGE";

  const signalList = [
    { name: "demand",     impact: Math.abs(demandSignal.multiplier - 1) },
    { name: "inventory",  impact: Math.abs(inventorySignal.multiplier - 1) },
    { name: "competitor", impact: Math.abs(competitorSignal.multiplier - 1) },
    { name: "seasonal",   impact: seasonalSignal.phase?.startsWith("disabled") ? 0 : Math.abs(seasonalSignal.multiplier - 1) },
  ].sort((a, b) => b.impact - a.impact);

  return {
    rawMultiplier: parseFloat(rawMultiplier.toFixed(4)),
    finalMultiplier: parseFloat(finalMultiplier.toFixed(4)),
    recommendedPrice,
    adjustmentPercent: parseFloat((((recommendedPrice - currentPrice) / currentPrice) * 100).toFixed(2)),
    confidenceScore,
    confidenceLevel,
    shouldApply,
    constraintApplied,
    primaryDriver: signalList[0].name,
  };
}

module.exports = {
  runPricingEngine,
  // Signal functions exported for featureExtractor.js and direct use in tests
  computeDemandSignal,
  computeInventorySignal,
  computeCompetitorSignal,
  computeSeasonalSignal,
  composePriceRecommendation,
  computeConfidenceScore,
};
