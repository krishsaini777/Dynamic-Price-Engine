const asyncHandler = require('../middleware/asyncHandler');
const SalesEvent = require('../models/salesEvent');
const Inventory = require('../models/inventory');
const Product = require('../models/product');
const { findActiveEventForProduct } = require('../services/eventService');
const { sendSuccess, sendError } = require('../utils/apiResponse');

// @desc    Record a sale event (drives demand calculation)
// @route   POST /api/v1/sales
const recordSale = asyncHandler(async (req, res) => {
  const { productId, quantity, priceAtSale, channel, soldAt } = req.body;
  const saleDate = soldAt ? new Date(soldAt) : new Date();
  const uid = req.user.uid;

  if (!quantity || quantity <= 0) {
    return sendError(res, 'quantity must be a positive number', 400);
  }

  // FIXED: was Product.findById — no ownership check
  const product = await Product.findOne({ _id: productId, ownerId: uid });
  if (!product) return sendError(res, 'Product not found', 404);

  // Auto-detect if a promotional event is active for this product at soldAt time
  const activeEvent = await findActiveEventForProduct(product, saleDate, uid);

  const sale = await SalesEvent.create({
    productId,
    quantity,
    priceAtSale,
    channel: channel || 'manual',
    soldAt: saleDate,
    eventId: activeEvent ? activeEvent._id : null,
    isPromotional: !!activeEvent,
  });

  // Deduct sold quantity from inventory (floor at 0)
  const inventory = await Inventory.findOne({ productId });
  if (inventory) {
    const newQty = Math.max(0, inventory.availableQuantity - quantity);
    const emaDailySales = inventory.emaDailySales;

    // Canonical thresholds: 0→CRITICAL, <=3→CRITICAL, <=7→LOW, <=21→NORMAL, >21→HIGH
    // (kept in sync with inventoryController.computeCoverageAndStatus and CoverageMeter.jsx)
    let coverageDays = null;
    let inventoryStatus = 'unknown';
    if (newQty === 0) {
      coverageDays = 0;
      inventoryStatus = 'critical';
    } else if (emaDailySales && emaDailySales > 0) {
      coverageDays = parseFloat((newQty / emaDailySales).toFixed(1));
      if (coverageDays <= 3)       inventoryStatus = 'critical';
      else if (coverageDays <= 7)  inventoryStatus = 'low';
      else if (coverageDays <= 21) inventoryStatus = 'normal';
      else                         inventoryStatus = 'high';
    }

    await Inventory.findByIdAndUpdate(inventory._id, {
      availableQuantity: newQty,
      coverageDays,
      inventoryStatus,
    });
  }

  sendSuccess(res, sale, 201);
});

// @desc    Get recent sales for a product (ownership enforced)
// @route   GET /api/v1/sales/:productId
const getProductSales = asyncHandler(async (req, res) => {
  const uid = req.user.uid;

  // FIXED: was SalesEvent.find({ productId }) — no ownership check
  const product = await Product.findOne({ _id: req.params.productId, ownerId: uid });
  if (!product) return sendError(res, 'Product not found', 404);

  const limit = parseInt(req.query.limit) || 100;
  const sales = await SalesEvent.find({ productId: req.params.productId })
    .sort({ soldAt: -1 })
    .limit(limit);
  sendSuccess(res, sales);
});

// @desc    Get computed velocity stats (ownership enforced)
// @route   GET /api/v1/sales/:productId/velocity
const getVelocity = asyncHandler(async (req, res) => {
  const productId = req.params.productId;
  const uid = req.user.uid;

  // FIXED: no ownership check previously
  const product = await Product.findOne({ _id: productId, ownerId: uid });
  if (!product) return sendError(res, 'Product not found', 404);

  const referenceDate = new Date();
  const sixHoursAgo = new Date(referenceDate - 6 * 3600 * 1000);
  const sevenDaysAgo = new Date(referenceDate - 7 * 24 * 3600 * 1000);

  const shortTermSales = await SalesEvent.find({
    productId, isCancelled: false,
    soldAt: { $gte: sixHoursAgo, $lte: referenceDate },
  });

  const shortTermOrganic = shortTermSales.filter(s => !s.eventId);
  const shortTermPromo = shortTermSales.filter(s => !!s.eventId);

  const organicShortTermRate = shortTermOrganic.reduce((sum, s) => sum + s.quantity, 0) / 6;
  const promoShortTermRate = shortTermPromo.reduce((sum, s) => sum + s.quantity, 0) / 6;
  const shortTermTotalRate = organicShortTermRate + promoShortTermRate;

  const longTermSales = await SalesEvent.find({
    productId, isCancelled: false,
    eventId: null,
    soldAt: { $gte: sevenDaysAgo, $lte: referenceDate },
  });

  const longTermOrganicTotal = longTermSales.reduce((sum, s) => sum + s.quantity, 0);
  const organicLongTermRate = longTermOrganicTotal / (7 * 24);

  const velocityRatio = organicLongTermRate > 0
    ? parseFloat((organicShortTermRate / organicLongTermRate).toFixed(2))
    : (organicShortTermRate > 0 ? 2.0 : 1.0);

  let interpretation;
  if (velocityRatio > 5) interpretation = 'SURGE';
  else if (velocityRatio > 2) interpretation = 'HIGH';
  else if (velocityRatio > 1.2) interpretation = 'RISING';
  else if (velocityRatio > 0.8) interpretation = 'STABLE';
  else if (velocityRatio > 0.5) interpretation = 'FALLING';
  else interpretation = 'LOW';

  const totalSalesCount = shortTermSales.length + longTermSales.length;
  const confidence = parseFloat(Math.min(1.0, totalSalesCount / 20).toFixed(2));

  sendSuccess(res, {
    productId,
    organicShortTermRate: parseFloat(organicShortTermRate.toFixed(2)),
    organicLongTermRate: parseFloat(organicLongTermRate.toFixed(2)),
    velocityRatio,
    interpretation,
    promoShortTermRate: parseFloat(promoShortTermRate.toFixed(2)),
    organicPercentage: shortTermTotalRate > 0 ? parseFloat((organicShortTermRate / shortTermTotalRate * 100).toFixed(1)) : 100,
    promoPercentage: shortTermTotalRate > 0 ? parseFloat((promoShortTermRate / shortTermTotalRate * 100).toFixed(1)) : 0,
    isEventActive: shortTermPromo.length > 0,
    totalSalesCount,
    confidence,
  });
});

module.exports = { recordSale, getProductSales, getVelocity };
