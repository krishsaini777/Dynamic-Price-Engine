/**
 * charmPrice — Rounds a price to the nearest ₹X49 or ₹X99 charm price
 * that does NOT exceed the input.
 *
 * Examples:
 *   charmPrice(1000) → 999
 *   charmPrice(1050) → 1049
 *   charmPrice(1025) → 999   ← old bug: was 999 too (correct here)
 *   charmPrice(1075) → 1049  ← old bug: was 1049 too (correct here)
 *   charmPrice(1100) → 1099
 *   charmPrice(850)  → 849
 *
 * Algorithm:
 *   For a given price P, the valid charm prices in the same hundred-block are:
 *     - floor(P / 100) * 100 - 1  → e.g. for P=1050, that is 1099? No.
 *   Correct approach: generate candidates ₹X49 and ₹X99 at or below P,
 *   then pick the highest one that doesn't exceed P.
 *
 * Time Complexity:  O(1)
 * Space Complexity: O(1)
 *
 * @param {number} price - The raw computed price (positive number)
 * @returns {number} The charm price (ends in 9, never exceeds input)
 */
function charmPrice(price) {
  if (!price || price <= 0) return price;

  const p = Math.round(price);

  // Generate the two charm candidates at or below p:
  // Candidate A: the ₹X99 at or below p (e.g. 999, 1099, 1199…)
  // Candidate B: the ₹X49 at or below p (e.g. 49, 149, 249, 349…)

  // ₹X99: every 100th price - 1 starting at 99
  // The highest ₹X99 <= p is: Math.floor((p - 99) / 100) * 100 + 99
  const charmA = Math.floor((p - 99) / 100) * 100 + 99; // e.g. p=1025 → 999

  // ₹X49: every 100th price starting at 49, offset by 50
  // The highest ₹X49 <= p is: Math.floor((p - 49) / 100) * 100 + 49
  const charmB = Math.floor((p - 49) / 100) * 100 + 49; // e.g. p=1025 → 1049? No: (1025-49)/100=9.76→9*100+49=949

  // Pick the highest charm price that does not exceed p
  const candidates = [charmA, charmB].filter((c) => c >= 0 && c <= p);
  if (candidates.length === 0) return p; // fallback for very small prices (< 49)

  return Math.max(...candidates);
}

/**
 * getDayOfYear — Returns the 1-indexed day of the year for a given date.
 * Used by the seasonal signal sigmoid ramp function.
 *
 * @param {Date|string} date
 * @returns {number} Day of year (1–366)
 */
function getDayOfYear(date) {
  const d = new Date(date);
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d - start;
  return Math.floor(diff / 86400000);
}

/**
 * clamp — Constrains a value to [min, max] range.
 * Used by the stability clamp guardrail.
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * AUTO_APPLY_THRESHOLD — Unified confidence threshold for autonomous price application.
 * Used by the scheduler to determine if a recommended price change can be applied automatically.
 *
 * Design Decision: 0.65 (not 0.5) because with ML in the loop, a price at 50%
 * confidence has too much uncertainty to apply without human review. 0.65 balances
 * automation coverage with safety.
 *
 * Bug Fix: Previously 0.5 in pricingEngine.js and 0.8 in scheduler.js — split-brain.
 * Now unified here so both code paths reference the same constant.
 */
const AUTO_APPLY_THRESHOLD = 0.65;

module.exports = { charmPrice, getDayOfYear, clamp, AUTO_APPLY_THRESHOLD };

