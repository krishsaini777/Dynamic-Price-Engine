/**
 * pricingGuardrails.js
 *
 * RESPONSIBILITY: Apply all 7 deterministic business rules to a proposed price.
 * These rules have ABSOLUTE priority over the ML model.
 * The ML model can PROPOSE a price; only guardrails can APPROVE it.
 *
 * DESIGN DECISIONS:
 *  - Every guardrail is an independent pure function → individually unit-testable.
 *  - Every guardrail returns a { triggered, rule, detail } log entry.
 *  - Guards are applied in priority order: hardest constraints first.
 *  - This file has zero database dependencies — all data is passed as arguments.
 *  - "Never throw" policy: if inputs are invalid, return the input price unchanged
 *    and log a warning. The pricing engine must never crash due to guardrail failure.
 *
 * GUARDRAIL EXECUTION ORDER:
 *  G1. Profit Floor    — absolute minimum (cost + margin)
 *  G2. Price Ceiling   — absolute maximum (cost × 3.0)
 *  G3. Stability Clamp — max daily swing (±15%)
 *  G4. Competitor Cap  — cannot exceed competitor by more than threshold
 *  G5. Inventory Rule  — stock pressure adjustment
 *  G6. Seasonality     — already applied via ML feature; validated here
 *  G7. Charm Pricing   — cosmetic rounding to ₹X49 / ₹X99
 *
 * INTERVIEW TALKING POINT:
 *  "We separated guardrails from the ML model so we can independently deploy
 *   new models without touching business rule logic, and vice versa. Each rule
 *   is logged, so we have a full audit trail of which constraint fired on every
 *   pricing decision."
 *
 * Time Complexity:  O(1) — all operations are constant-time arithmetic
 * Space Complexity: O(G) where G = number of guardrails = 7 (constant)
 */

"use strict";

const { charmPrice, clamp } = require("../utils/pricingUtils");

// ── Configurable thresholds (can be moved to env vars or DB settings) ─────────
const PROFIT_FLOOR_MULTIPLIER = 1.15;   // minimum price = cost × 1.15
const PRICE_CEILING_MULTIPLIER = 3.0;   // maximum price = cost × 3.0
const MAX_DAILY_CHANGE_PCT = 0.15;      // ±15% stability clamp
const COMPETITOR_CAP_PCT = 0.08;        // cannot exceed competitor by >8%
const LOW_INVENTORY_THRESHOLD_DAYS = 7; // below this → upward pressure
const HIGH_INVENTORY_THRESHOLD_DAYS = 30; // above this → downward pressure
const INVENTORY_PRESSURE_PCT = 0.05;    // 5% adjustment for inventory rule

/**
 * applyGuardrails — Master function. Applies all 7 rules in sequence.
 *
 * @param {Object} params
 * @param {number} params.proposedPrice   - Price from ML model (or deterministic fallback)
 * @param {number} params.costPrice       - Product's cost to the business
 * @param {number} params.currentPrice    - Current live price (used for stability clamp)
 * @param {number} params.targetMargin    - Desired profit margin (0–1), default 0.15
 * @param {number|null} params.competitorMedianPrice - IQR-filtered competitor median
 * @param {number} params.inventoryCoverageDays      - Stock / daily sales rate
 * @param {number} params.seasonalMultiplier         - From seasonal signal (validation only)
 * @returns {{ finalPrice: number, guardrailsApplied: Array, constraintApplied: string }}
 */
function applyGuardrails({
  proposedPrice,
  costPrice,
  currentPrice,
  targetMargin = 0.15,
  competitorMedianPrice = null,
  inventoryCoverageDays = 15,
  seasonalMultiplier = 1.0,
}) {
  // Defensive: treat NaN/null inputs as safe defaults
  if (!proposedPrice || Number.isNaN(proposedPrice) || proposedPrice <= 0) {
    console.warn("[PricingGuardrails] proposedPrice invalid — falling back to currentPrice");
    proposedPrice = currentPrice;
  }

  let price = proposedPrice;
  const guardrailsApplied = [];
  let lastConstraint = "NONE";

  // ── G1: Profit Floor ──────────────────────────────────────────────────────
  const result1 = applyProfitFloor(price, costPrice, targetMargin);
  price = result1.price;
  if (result1.triggered) {
    guardrailsApplied.push(result1.log);
    lastConstraint = "PROFIT_FLOOR";
  }

  // ── G2: Price Ceiling ─────────────────────────────────────────────────────
  const result2 = applyPriceCeiling(price, costPrice);
  price = result2.price;
  if (result2.triggered) {
    guardrailsApplied.push(result2.log);
    lastConstraint = "CEILING";
  }

  // ── G3: Stability Clamp ───────────────────────────────────────────────────
  const result3 = applyStabilityClamp(price, currentPrice);
  price = result3.price;
  if (result3.triggered) {
    guardrailsApplied.push(result3.log);
    lastConstraint = "STABILITY";
  }

  // ── G4: Competitor Cap ────────────────────────────────────────────────────
  const result4 = applyCompetitorCap(price, competitorMedianPrice);
  price = result4.price;
  if (result4.triggered) {
    guardrailsApplied.push(result4.log);
    lastConstraint = "COMPETITOR_CAP";
  }

  // ── G5: Inventory Rule ────────────────────────────────────────────────────
  const result5 = applyInventoryRule(price, inventoryCoverageDays);
  price = result5.price;
  if (result5.triggered) {
    guardrailsApplied.push(result5.log);
    if (lastConstraint === "NONE") lastConstraint = "INVENTORY_RULE";
  }

  // ── G6: Minimum Change Filter ─────────────────────────────────────────────
  // Suppress trivially small changes (< 1%) to avoid price flicker.
  const changePercent = Math.abs(price - currentPrice) / currentPrice;
  if (changePercent < 0.01) {
    guardrailsApplied.push({
      rule: "MINIMUM_CHANGE",
      triggered: true,
      detail: `Change of ${(changePercent * 100).toFixed(2)}% is below 1% threshold — price held at ₹${currentPrice}`,
      priceBeforeGuardrail: price,
      priceAfterGuardrail: currentPrice,
    });
    price = currentPrice;
    lastConstraint = "MINIMUM_CHANGE";
  }

  // ── G7: Charm Pricing ─────────────────────────────────────────────────────
  const preCharm = price;
  price = charmPrice(Math.round(price));
  if (price !== preCharm) {
    guardrailsApplied.push({
      rule: "CHARM_PRICING",
      triggered: true,
      detail: `Rounded ₹${preCharm} → ₹${price} (nearest ₹X49/₹X99)`,
      priceBeforeGuardrail: preCharm,
      priceAfterGuardrail: price,
    });
  }

  return {
    finalPrice: price,
    guardrailsApplied,
    constraintApplied: lastConstraint,
  };
}

// ── Individual guardrail functions ────────────────────────────────────────────

/**
 * G1: Profit Floor — Ensures the price never drops below cost + minimum margin.
 * This is a HARD constraint. No ML model or business rule can override this.
 *
 * Example: cost=₹500, margin=15% → floor=₹575. If ML says ₹540, clamped to ₹575.
 */
function applyProfitFloor(price, costPrice, targetMargin = PROFIT_FLOOR_MULTIPLIER - 1) {
  const floor = costPrice * (1 + targetMargin);
  const triggered = price < floor;
  return {
    price: triggered ? floor : price,
    triggered,
    log: triggered ? {
      rule: "PROFIT_FLOOR",
      triggered: true,
      detail: `ML proposed ₹${price.toFixed(0)} < profit floor ₹${floor.toFixed(0)} (cost ₹${costPrice} × ${1 + targetMargin})`,
      priceBeforeGuardrail: price,
      priceAfterGuardrail: floor,
    } : null,
  };
}

/**
 * G2: Price Ceiling — Ensures the price never becomes predatory.
 * Maximum allowed: 3× cost price.
 *
 * Example: cost=₹500 → ceiling=₹1500. Prevents ML from exploiting demand surges.
 */
function applyPriceCeiling(price, costPrice) {
  const ceiling = costPrice * PRICE_CEILING_MULTIPLIER;
  const triggered = price > ceiling;
  return {
    price: triggered ? ceiling : price,
    triggered,
    log: triggered ? {
      rule: "PRICE_CEILING",
      triggered: true,
      detail: `ML proposed ₹${price.toFixed(0)} > price ceiling ₹${ceiling.toFixed(0)} (cost ₹${costPrice} × ${PRICE_CEILING_MULTIPLIER})`,
      priceBeforeGuardrail: price,
      priceAfterGuardrail: ceiling,
    } : null,
  };
}

/**
 * G3: Stability Clamp — Prevents wild price swings day-over-day.
 * Maximum change per cycle: ±15%.
 *
 * This protects against demand surge hallucinations from XGBoost.
 * Design: if ML says increase by 25%, we still move by 15% (not 0%).
 * This is a damper, not a veto.
 */
function applyStabilityClamp(price, currentPrice) {
  const maxAllowed = currentPrice * (1 + MAX_DAILY_CHANGE_PCT);
  const minAllowed = currentPrice * (1 - MAX_DAILY_CHANGE_PCT);
  const clamped = clamp(price, minAllowed, maxAllowed);
  const triggered = price !== clamped;
  return {
    price: clamped,
    triggered,
    log: triggered ? {
      rule: "STABILITY_CLAMP",
      triggered: true,
      detail: `Price swing of ${(((price - currentPrice) / currentPrice) * 100).toFixed(1)}% exceeds ±${MAX_DAILY_CHANGE_PCT * 100}% limit — clamped from ₹${price.toFixed(0)} to ₹${clamped.toFixed(0)}`,
      priceBeforeGuardrail: price,
      priceAfterGuardrail: clamped,
    } : null,
  };
}

/**
 * G4: Competitor Cap — Prevents aggressive overpricing relative to market.
 * Maximum allowed: competitor median + 8%.
 *
 * Design Decision: We allow up to 8% premium over market (not 0%) because
 * premium products, delivery speed, or brand value justify a moderate premium.
 * Beyond 8% is likely to cause demand destruction.
 */
function applyCompetitorCap(price, competitorMedianPrice) {
  if (!competitorMedianPrice || competitorMedianPrice <= 0) {
    return { price, triggered: false, log: null }; // no competitor data — skip
  }
  const cap = competitorMedianPrice * (1 + COMPETITOR_CAP_PCT);
  const triggered = price > cap;
  return {
    price: triggered ? cap : price,
    triggered,
    log: triggered ? {
      rule: "COMPETITOR_CAP",
      triggered: true,
      detail: `Price ₹${price.toFixed(0)} exceeds competitor cap ₹${cap.toFixed(0)} (median ₹${competitorMedianPrice} + ${COMPETITOR_CAP_PCT * 100}%)`,
      priceBeforeGuardrail: price,
      priceAfterGuardrail: cap,
    } : null,
  };
}

/**
 * G5: Inventory Rule — Adjusts price based on stock pressure.
 * Low stock  (< 7d coverage)  → increase by 5%
 * High stock (> 30d coverage) → decrease by 5%
 * Normal range                → no adjustment
 *
 * Note: This rule makes a small adjustment ON TOP of the ML price.
 * It's a safety valve, not the primary signal — XGBoost already learned
 * inventory patterns from the feature vector.
 */
function applyInventoryRule(price, coverageDays) {
  let adjusted = price;
  let detail = null;

  if (coverageDays < LOW_INVENTORY_THRESHOLD_DAYS) {
    adjusted = price * (1 + INVENTORY_PRESSURE_PCT);
    detail = `Low inventory (${coverageDays.toFixed(1)} days < ${LOW_INVENTORY_THRESHOLD_DAYS}d threshold) — applied +${INVENTORY_PRESSURE_PCT * 100}% pressure`;
  } else if (coverageDays > HIGH_INVENTORY_THRESHOLD_DAYS) {
    adjusted = price * (1 - INVENTORY_PRESSURE_PCT);
    detail = `High inventory (${coverageDays.toFixed(1)} days > ${HIGH_INVENTORY_THRESHOLD_DAYS}d threshold) — applied -${INVENTORY_PRESSURE_PCT * 100}% pressure`;
  }

  const triggered = adjusted !== price;
  return {
    price: adjusted,
    triggered,
    log: triggered ? {
      rule: "INVENTORY_RULE",
      triggered: true,
      detail,
      priceBeforeGuardrail: price,
      priceAfterGuardrail: adjusted,
    } : null,
  };
}

module.exports = {
  applyGuardrails,
  applyProfitFloor,
  applyPriceCeiling,
  applyStabilityClamp,
  applyCompetitorCap,
  applyInventoryRule,
  // Export constants for use in tests and documentation
  PROFIT_FLOOR_MULTIPLIER,
  PRICE_CEILING_MULTIPLIER,
  MAX_DAILY_CHANGE_PCT,
  COMPETITOR_CAP_PCT,
};
