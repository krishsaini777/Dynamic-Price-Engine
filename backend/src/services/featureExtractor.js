/**
 * featureExtractor.js
 *
 * RESPONSIBILITY: Extract a normalized 19-feature vector from MongoDB for a
 * given product. This is the ONLY file that reads from the database for ML
 * purposes. All other ML services receive pre-extracted feature objects.
 *
 * DESIGN DECISIONS:
 *  - Single Responsibility: this file does nothing but read and normalize.
 *  - All DB reads are parallelized with Promise.all where possible.
 *  - Every feature has a documented fallback value so the vector is always
 *    complete even with missing data (never NaN, never undefined).
 *  - Category and tier are label-encoded to integers because XGBoost requires
 *    numerical inputs. The encoding is deterministic and documented.
 *
 * FEATURE VECTOR (19 features):
 *  [0]  costPrice              — product cost basis
 *  [1]  currentPrice           — live market price
 *  [2]  priceToCostratio       — currentPrice / costPrice
 *  [3]  targetMargin           — desired profit margin (0–1)
 *  [4]  competitorMedianPrice  — IQR-filtered competitor median (or currentPrice if no data)
 *  [5]  competitorGapPct       — (competitorMedian - currentPrice) / currentPrice * 100
 *  [6]  inventoryCoverageDays  — availableQty / emaDailySales
 *  [7]  availableQuantity      — raw stock count
 *  [8]  emaDailySales          — EMA of daily organic sales (cached on Inventory doc)
 *  [9]  demandVelocityRatio    — shortTermRate / longTermRate (6h vs 7d)
 *  [10] organicSalesRatio      — organic / total short-term sales (0–1)
 *  [11] rollingAvgSales7d      — mean daily organic sales over last 7 days
 *  [12] dayOfWeek              — 0=Monday … 6=Sunday
 *  [13] monthOfYear            — 1=January … 12=December
 *  [14] isFestivalPeriod       — 1 if in a known Indian festival window, else 0
 *  [15] seasonalMultiplier     — output of existing computeSeasonalSignal (1.0 = neutral)
 *  [16] isPromotionalEventActive — 1 if a promo event is running for this product
 *  [17] categoryEncoded        — integer (see CATEGORY_ENCODING below)
 *  [18] tierEncoded            — 0=budget, 1=mid, 2=premium
 *
 * Time Complexity per call: O(S) where S = number of SalesEvent records in 7d window
 * Space Complexity: O(S) for the sales aggregation buffer
 */

"use strict";

const Product = require("../models/product");
const Inventory = require("../models/inventory");
const CompetitorPrice = require("../models/competitorPrice");
const SalesEvent = require("../models/salesEvent");
const Settings = require("../models/settings");
const { computeAttributedDemand } = require("./demandAttribution");
const eventService = require("./eventService");

// ── Category label encoding ───────────────────────────────────────────────────
// Deterministic integer mapping used by the Python training script.
// NEVER reorder — would invalidate trained model weights.
const CATEGORY_ENCODING = {
  Electronics: 0,
  Clothing: 1,
  Home: 2,
  Sports: 3,
  Books: 4,
  Food: 5,
  Beauty: 6,
  Toys: 7,
  Automotive: 8,
  Other: 9,
};

// ── Tier label encoding ───────────────────────────────────────────────────────
const TIER_ENCODING = {
  budget: 0,
  mid: 1,
  premium: 2,
};

// ── Indian festival windows (approximate day-of-year ranges) ─────────────────
// Used for isFestivalPeriod binary feature.
// Diwali:    Oct 15 – Nov 15  → DOY 288–319
// Navratri:  Oct 3  – Oct 13  → DOY 276–286
// Holi:      Mar 1  – Mar 10  → DOY 60–69
// Christmas: Dec 20 – Dec 31  → DOY 354–365
// New Year:  Jan 1  – Jan 7   → DOY 1–7
const FESTIVAL_WINDOWS = [
  [1, 7],    // New Year
  [60, 69],  // Holi
  [276, 319], // Navratri + Diwali
  [354, 365], // Christmas
];

/**
 * isFestival — Returns 1 if the given day-of-year falls in a festival window.
 *
 * @param {number} doy - Day of year (1–366)
 * @returns {0|1}
 */
function isFestival(doy) {
  return FESTIVAL_WINDOWS.some(([start, end]) => doy >= start && doy <= end) ? 1 : 0;
}

/**
 * getDayOfYear — Compute 1-indexed day of year.
 * Duplicated here to avoid circular dep with pricingUtils.
 *
 * @param {Date} date
 * @returns {number}
 */
function getDayOfYear(date) {
  const d = new Date(date);
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d - start) / 86400000);
}

/**
 * computeRollingAvgSales7d — Aggregates organic sales into a mean-daily
 * sales figure over the last 7 days. This is different from EMA — it's a
 * simple rolling mean, useful as a separate feature to capture trend changes.
 *
 * @param {ObjectId|string} productId
 * @param {Date} referenceDate
 * @returns {Promise<number>} Mean daily organic sales (0 if no data)
 */
async function computeRollingAvgSales7d(productId, referenceDate) {
  const sevenDaysAgo = new Date(referenceDate - 7 * 24 * 3600 * 1000);

  const sales = await SalesEvent.find({
    productId,
    isCancelled: false,
    eventId: null, // organic only
    soldAt: { $gte: sevenDaysAgo, $lte: referenceDate },
  }).select("quantity soldAt");

  if (sales.length === 0) return 0;

  // Aggregate into daily buckets
  const dailyTotals = {};
  sales.forEach((s) => {
    const day = s.soldAt.toISOString().slice(0, 10);
    dailyTotals[day] = (dailyTotals[day] || 0) + s.quantity;
  });

  const days = Object.keys(dailyTotals);
  const total = days.reduce((sum, d) => sum + dailyTotals[d], 0);
  return parseFloat((total / 7).toFixed(3)); // divide by 7 days, not by active days
}

/**
 * _computeCompetitorSignal — Private inline implementation to avoid circular
 * dependency with pricingEngine.js. Identical logic, prefixed with _ to signal
 * it is internal to this module.
 *
 * Circular dependency explanation:
 *  featureExtractor.js → pricingEngine.js → featureExtractor.js  ← CIRCULAR
 *  Solution: inline the two pure functions here (no side effects, no DB calls).
 */
function _computeCompetitorSignal(competitorRecords, ourPrice) {
  if (!competitorRecords || competitorRecords.length === 0) {
    return { multiplier: 1.0, confidence: 0, medianPrice: null, gapPercent: 0 };
  }

  const now = Date.now();
  const fresh = competitorRecords
    .map((r) => ({ price: r.competitorPrice, age: (now - new Date(r.updatedAt)) / 3600000 }))
    .filter((r) => r.age <= 72)
    .map((r) => ({ price: r.price, weight: 1 - r.age / 72 }));

  if (fresh.length === 0) {
    return { multiplier: 1.0, confidence: 0, medianPrice: null, gapPercent: 0 };
  }

  const prices = fresh.map((r) => r.price).sort((a, b) => a - b);
  const q1 = prices[Math.floor(prices.length * 0.25)] ?? prices[0];
  const q3 = prices[Math.floor(prices.length * 0.75)] ?? prices[prices.length - 1];
  const iqr = q3 - q1;
  const inliers = fresh.filter((r) => r.price >= q1 - 1.5 * iqr && r.price <= q3 + 1.5 * iqr);
  const medianPrice = inliers[Math.floor(inliers.length / 2)]?.price ?? ourPrice;
  const gapPercent = ((medianPrice - ourPrice) / ourPrice) * 100;

  return {
    medianPrice,
    gapPercent: parseFloat(gapPercent.toFixed(2)),
    confidence: Math.min(1, inliers.length / 5),
  };
}

/**
 * _computeSeasonalSignal — Private inline implementation to avoid circular
 * dependency with pricingEngine.js. Reads from Settings collection.
 */
async function _computeSeasonalSignal(product, referenceDate, ownerId) {
  // PERF: Fetch both settings in parallel — they are independent reads.
  // Previously sequential: disabled-categories query waited for enabled-flag query (~50-100ms wasted).
  const [globalSetting, disabledCats] = await Promise.all([
    Settings.findOne({ key: "seasonalPricingEnabled", ownerId }),
    Settings.findOne({ key: "seasonalDisabledCategories", ownerId }),
  ]);

  if (globalSetting && globalSetting.value === false) {
    return { multiplier: 1.0 };
  }

  if (disabledCats && Array.isArray(disabledCats.value) && disabledCats.value.includes(product.category)) {
    return { multiplier: 1.0 };
  }

  const sc = product.seasonalConfig;
  if (!sc || sc.season === "none") return { multiplier: 1.0 };

  const doy = getDayOfYear(referenceDate);
  const startDoy = getDayOfYear(sc.startDate);
  const peakDoy = getDayOfYear(sc.peakDate);
  const endDoy = getDayOfYear(sc.endDate);
  const maxBoost = sc.maxBoost || 0.12;
  const sigmoid = (x) => 1 / (1 + Math.exp(-10 * (x - 0.5)));

  if (doy >= startDoy && doy <= peakDoy) {
    const progress = (doy - startDoy) / (peakDoy - startDoy || 1);
    return { multiplier: 1.0 + maxBoost * sigmoid(progress) };
  }
  if (doy > peakDoy && doy <= endDoy) {
    const progress = (doy - peakDoy) / (endDoy - peakDoy || 1);
    return { multiplier: 1.0 + maxBoost * (1 - sigmoid(progress)) };
  }
  return { multiplier: 1.0 };
}

/**
 * extractFeatures — Main export. Builds the complete 19-feature vector for
 * a given product at a specific point in time.
 *
 * This function is intentionally read-only — it never writes to the database.
 *
 * @param {Object} params
 * @param {string|ObjectId} params.productId
 * @param {Date} params.referenceDate
 * @param {string} params.ownerId - Firebase UID for scoped settings/events lookups
 * @returns {Promise<{vector: number[], meta: Object}>}
 *   vector — array of 19 numbers in the canonical order (matches training data columns)
 *   meta   — labelled object for logging and debugging
 */
async function extractFeatures({ productId, referenceDate = new Date(), ownerId, preComputedDemand = null }) {
  // ── Parallel DB reads ─────────────────────────────────────────────────────
  // PERF (BN-4): Accept a pre-computed attributedDemand to avoid a duplicate
  // DB fetch. pricingEngine.js computes demand at step 2 and passes it here,
  // eliminating 2 SalesEvent queries per pricing call (~100-200ms saved).
  // Callers that don't pass preComputedDemand still get the original behaviour.
  const demandPromise = preComputedDemand
    ? Promise.resolve(preComputedDemand)
    : computeAttributedDemand(productId, referenceDate);

  const [product, inventory, competitors, attributedDemand, rollingAvg] =
    await Promise.all([
      Product.findById(productId),
      Inventory.findOne({ productId }),
      CompetitorPrice.find({ productId }),
      demandPromise,
      computeRollingAvgSales7d(productId, referenceDate),
    ]);

  if (!product) throw new Error(`[FeatureExtractor] Product ${productId} not found`);
  if (!inventory) throw new Error(`[FeatureExtractor] Inventory for ${productId} not found`);

  // ── Competitor features ───────────────────────────────────────────────────
  const competitorSignal = _computeCompetitorSignal(competitors, product.currentPrice);
  const competitorMedianPrice = competitorSignal.medianPrice ?? product.currentPrice;
  const competitorGapPct = competitorSignal.gapPercent ?? 0;

  // ── Seasonal feature (inline implementation — no circular dep) ────────────
  const seasonalSignal = await _computeSeasonalSignal(product, referenceDate, ownerId);

  // ── Promotional event feature ─────────────────────────────────────────────
  const activeEvent = await eventService.findActiveEventForProduct(
    product,
    referenceDate,
    ownerId,
  );
  const isPromotionalEventActive = activeEvent ? 1 : 0;

  // ── Calendar features ─────────────────────────────────────────────────────
  const ref = new Date(referenceDate);
  const dayOfWeek = (ref.getDay() + 6) % 7; // 0=Mon, 6=Sun (JS getDay: 0=Sun)
  const monthOfYear = ref.getMonth() + 1;   // 1=Jan, 12=Dec
  const doy = getDayOfYear(ref);
  const festivalPeriod = isFestival(doy);

  // ── Inventory features ────────────────────────────────────────────────────
  const availableQuantity = inventory.availableQuantity ?? 0;
  const emaDailySales = attributedDemand.longTermRate * 24 || inventory.emaDailySales || 1;
  const inventoryCoverageDays = emaDailySales > 0
    ? parseFloat((availableQuantity / emaDailySales).toFixed(2))
    : 999; // 999 = "indefinite coverage" — model will learn this boundary

  // ── Demand features ───────────────────────────────────────────────────────
  const demandVelocityRatio = attributedDemand.velocityRatio ?? 1.0;
  // FIX: demandAttribution.js returns `organicPercentage` (0-100), not `organicSalesRatio`.
  // Using the wrong key caused this feature to always be undefined → defaulted to 1.0,
  // permanently biasing XGBoost feature [10] and degrading prediction quality.
  const organicSalesRatio = attributedDemand.organicPercentage !== undefined
    ? attributedDemand.organicPercentage / 100  // convert pct → ratio (0–1)
    : 1.0;

  // ── Price features ────────────────────────────────────────────────────────
  const costPrice = product.costPrice;
  const currentPrice = product.currentPrice;
  const priceToCostratio = costPrice > 0 ? parseFloat((currentPrice / costPrice).toFixed(3)) : 1;
  const targetMargin = product.targetMargin ?? 0.15;

  // ── Category / Tier encoding ──────────────────────────────────────────────
  const categoryEncoded = CATEGORY_ENCODING[product.category] ?? CATEGORY_ENCODING.Other;
  const tierEncoded = TIER_ENCODING[product.tier] ?? TIER_ENCODING.mid;

  // ── Assemble canonical vector (order MUST match training CSV columns) ─────
  const vector = [
    costPrice,               // [0]
    currentPrice,            // [1]
    priceToCostratio,        // [2]
    targetMargin,            // [3]
    competitorMedianPrice,   // [4]
    competitorGapPct,        // [5]
    inventoryCoverageDays,   // [6]
    availableQuantity,       // [7]
    emaDailySales,           // [8]
    demandVelocityRatio,     // [9]
    organicSalesRatio,       // [10]
    rollingAvg,              // [11]
    dayOfWeek,               // [12]
    monthOfYear,             // [13]
    festivalPeriod,          // [14]
    seasonalSignal.multiplier ?? 1.0, // [15]
    isPromotionalEventActive, // [16]
    categoryEncoded,          // [17]
    tierEncoded,              // [18]
  ];

  // ── Sanity check: no NaN/undefined in vector ──────────────────────────────
  const sanitized = vector.map((v, i) => {
    if (v === null || v === undefined || Number.isNaN(v)) {
      console.warn(`[FeatureExtractor] Feature[${i}] was NaN/null — defaulting to 0`);
      return 0;
    }
    return v;
  });

  // ── Meta object for logging and debugging ─────────────────────────────────
  const meta = {
    costPrice,
    currentPrice,
    priceToCostratio,
    targetMargin,
    competitorMedianPrice,
    competitorGapPct,
    inventoryCoverageDays,
    availableQuantity,
    emaDailySales,
    demandVelocityRatio,
    organicSalesRatio,
    rollingAvgSales7d: rollingAvg,
    dayOfWeek,
    monthOfYear,
    isFestivalPeriod: festivalPeriod,
    seasonalMultiplier: seasonalSignal.multiplier ?? 1.0,
    isPromotionalEventActive,
    categoryEncoded,
    tierEncoded,
  };

  return { vector: sanitized, meta };
}

module.exports = {
  extractFeatures,
  CATEGORY_ENCODING,
  TIER_ENCODING,
  FESTIVAL_WINDOWS,
  computeRollingAvgSales7d,
};
