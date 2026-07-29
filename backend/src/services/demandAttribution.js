const SalesEvent = require("../models/salesEvent");

async function computeAttributedDemand(productId, referenceDate = new Date()) {
  const sixHoursAgo = new Date(referenceDate - 6 * 3600 * 1000);
  const sevenDaysAgo = new Date(referenceDate - 7 * 24 * 3600 * 1000);

  // PERF: Run both time-window queries in parallel — they are completely independent.
  // Previously sequential: long-term query waited for short-term to finish (~100-200ms wasted).
  const [shortTermSales, longTermSales] = await Promise.all([
    SalesEvent.find({
      productId,
      isCancelled: false,
      soldAt: { $gte: sixHoursAgo, $lte: referenceDate },
    }),
    SalesEvent.find({
      productId,
      isCancelled: false,
      eventId: null,
      soldAt: { $gte: sevenDaysAgo, $lte: referenceDate },
    }),
  ]);

  const shortTermOrganic = shortTermSales.filter((s) => !s.eventId);
  const shortTermPromo = shortTermSales.filter((s) => !!s.eventId);

  const shortTermOrganicRate =
    shortTermOrganic.reduce((sum, s) => sum + s.quantity, 0) / 6;
  const shortTermPromoRate =
    shortTermPromo.reduce((sum, s) => sum + s.quantity, 0) / 6;
  const shortTermTotalRate = shortTermOrganicRate + shortTermPromoRate;

  const longTermOrganicTotal = longTermSales.reduce(
    (sum, s) => sum + s.quantity,
    0,
  );
  const longTermOrganicRate = longTermOrganicTotal / (7 * 24);

  let organicVelocityRatio;
  if (longTermOrganicRate > 0) {
    organicVelocityRatio = shortTermOrganicRate / longTermOrganicRate;
  } else if (shortTermOrganicRate > 0) {
    organicVelocityRatio = 2.0;
  } else {
    organicVelocityRatio = 1.0;
  }

  const totalShortTermCount = shortTermSales.length;
  const totalLongTermCount = longTermSales.length;

  return {
    shortTermRate: shortTermOrganicRate,
    longTermRate: longTermOrganicRate,
    velocityRatio: organicVelocityRatio,
    totalShortTermRate: shortTermTotalRate,
    organicShortTermRate: shortTermOrganicRate,
    promoShortTermRate: shortTermPromoRate,
    organicPercentage:
      shortTermTotalRate > 0
        ? parseFloat(
            ((shortTermOrganicRate / shortTermTotalRate) * 100).toFixed(1),
          )
        : 100,
    promoPercentage:
      shortTermTotalRate > 0
        ? parseFloat(
            ((shortTermPromoRate / shortTermTotalRate) * 100).toFixed(1),
          )
        : 0,
    totalSalesCount: totalShortTermCount + totalLongTermCount,
    isEventActive: shortTermPromo.length > 0,
  };
}

module.exports = { computeAttributedDemand };
