const SalesEvent = require("../models/salesEvent");
const Inventory = require("../models/inventory");

const EMA_ALPHA = 0.3;

async function updateEMAForProduct(productId, alpha = EMA_ALPHA) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  const sales = await SalesEvent.find({
    productId,
    isCancelled: false,
    eventId: null,
    soldAt: { $gte: thirtyDaysAgo },
  }).sort({ soldAt: 1 });

  if (sales.length === 0) {
    return null;
  }

  const dailyTotals = {};
  sales.forEach((sale) => {
    const day = sale.soldAt.toISOString().slice(0, 10);
    dailyTotals[day] = (dailyTotals[day] || 0) + sale.quantity;
  });

  const days = Object.keys(dailyTotals).sort();
  let ema = dailyTotals[days[0]];
  for (let i = 1; i < days.length; i++) {
    ema = alpha * dailyTotals[days[i]] + (1 - alpha) * ema;
  }

  const emaDailySales = parseFloat(ema.toFixed(2));

  const inventory = await Inventory.findOne({ productId });
  if (!inventory) return null;

  const coverageDays =
    emaDailySales > 0
      ? parseFloat((inventory.availableQuantity / emaDailySales).toFixed(1))
      : null;

  // Canonical thresholds (must match inventoryController.computeCoverageAndStatus and CoverageMeter.jsx):
  //   qty=0 → CRITICAL | <=3d → CRITICAL | <=7d → LOW | <=21d → NORMAL | >21d → HIGH | no EMA → UNKNOWN
  let inventoryStatus = 'unknown';
  if (inventory.availableQuantity === 0) {
    inventoryStatus = 'critical';
  } else if (coverageDays !== null) {
    if (coverageDays <= 3)       inventoryStatus = 'critical';
    else if (coverageDays <= 7)  inventoryStatus = 'low';
    else if (coverageDays <= 21) inventoryStatus = 'normal';
    else                         inventoryStatus = 'high';
  }

  await Inventory.findOneAndUpdate(
    { productId },
    {
      emaDailySales,
      emaSalesUpdatedAt: new Date(),
      coverageDays,
      inventoryStatus,
    },
  );

  return { emaDailySales, coverageDays, inventoryStatus };
}

module.exports = { updateEMAForProduct };
