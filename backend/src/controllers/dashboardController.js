const asyncHandler = require('../middleware/asyncHandler');
const mongoose = require('mongoose');
const Product = require('../models/product');
const Inventory = require('../models/inventory');
const PricingRecommendation = require('../models/pricingRecommendation');
const PromotionalEvent = require('../models/promotionalEvent');
const SalesEvent = require('../models/salesEvent');
const Settings = require('../models/settings');
const { sendSuccess } = require('../utils/apiResponse');

// @desc    Main dashboard KPIs — ALL stats scoped to the authenticated user
// @route   GET /api/v1/dashboard/stats
const getDashboardStats = asyncHandler(async (req, res) => {
  const uid = req.user.uid;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ── WAVE 1: Parallel — fetch product counts + settings (no cross-dependencies) ──
  // Previously: 3 sequential countDocuments + 1 find + 2 settings = 6 round-trips sequentially.
  // Now: all fire at once.
  const [
    totalProducts,
    activeProducts,
    pricedToday,
    userProductsRaw,
    seasonalEnabled,
    seasonalCategories,
  ] = await Promise.all([
    Product.countDocuments({ ownerId: uid }),
    Product.countDocuments({ ownerId: uid, isActive: true }),
    Product.countDocuments({ ownerId: uid, lastPricedAt: { $gte: today } }),
    Product.find({ ownerId: uid }).select('_id').lean(),
    Settings.findOne({ key: 'seasonalPricingEnabled', ownerId: uid }),
    Settings.findOne({ key: 'seasonalDisabledCategories', ownerId: uid }),
  ]);

  const ownedIds = userProductsRaw.map(p => p._id);

  // ── WAVE 2: Parallel — all queries that depend on ownedIds ─────────────────
  // Previously: 10+ sequential queries each waiting on the previous.
  // Now: all fire concurrently after ownedIds is resolved.
  const [
    inventoryFacet,
    inventoryValueAgg,
    pendingRecommendations,
    appliedToday,
    recentApplied,
    activeEvents,
    upcomingEvents,
    promoSalesToday,
    recentRecommendations,
    activeEventsList,
  ] = await Promise.all([
    // Collapse all 4 inventory status counts into a single $facet query
    Inventory.aggregate([
      { $match: { productId: { $in: ownedIds } } },
      {
        $facet: {
          critical: [{ $match: { inventoryStatus: 'critical' } }, { $count: 'n' }],
          low:      [{ $match: { inventoryStatus: 'low' } },      { $count: 'n' }],
          normal:   [{ $match: { inventoryStatus: 'normal' } },   { $count: 'n' }],
          high:     [{ $match: { inventoryStatus: 'high' } },     { $count: 'n' }],
        },
      },
    ]),

    // PERF: Compute total inventory value server-side via $lookup + $group.
    // Previously: loaded all inventory docs + populated product.costPrice into Node memory.
    // Now: DB does the join and multiplication — returns a single number.
    Inventory.aggregate([
      { $match: { productId: { $in: ownedIds } } },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: null,
          totalValue: {
            $sum: { $multiply: ['$availableQuantity', { $ifNull: ['$product.costPrice', 0] }] },
          },
        },
      },
    ]),

    PricingRecommendation.countDocuments({ ownerId: uid, status: 'PENDING' }),
    PricingRecommendation.countDocuments({ ownerId: uid, status: 'APPLIED', appliedAt: { $gte: today } }),
    PricingRecommendation.find({ ownerId: uid, status: 'APPLIED' })
      .sort({ appliedAt: -1 }).limit(20).select('outcome.confidenceScore outcome.adjustmentPercent').lean(),
    PromotionalEvent.countDocuments({ ownerId: uid, status: 'ACTIVE' }),
    PromotionalEvent.countDocuments({ ownerId: uid, status: 'SCHEDULED' }),
    SalesEvent.find({
      productId: { $in: ownedIds },
      isPromotional: true,
      isCancelled: false,
      soldAt: { $gte: today },
    }).select('quantity priceAtSale').lean(),
    PricingRecommendation.find({ ownerId: uid })
      .sort({ createdAt: -1 }).limit(5)
      .populate('productId', 'productName sku category currentPrice tier'),
    PromotionalEvent.find({ ownerId: uid, status: 'ACTIVE' }).limit(1).lean(),
  ]);

  // ── Compute derived values from Wave 2 results ─────────────────────────────
  const invCounts = inventoryFacet[0] || {};
  const criticalCount = invCounts.critical?.[0]?.n || 0;
  const lowCount      = invCounts.low?.[0]?.n      || 0;
  const normalCount   = invCounts.normal?.[0]?.n   || 0;
  const highCount     = invCounts.high?.[0]?.n     || 0;

  const totalValue = inventoryValueAgg[0]?.totalValue || 0;

  let avgConfidenceScore = 0;
  let avgAdjustmentPercent = 0;
  if (recentApplied.length > 0) {
    avgConfidenceScore = recentApplied.reduce((s, r) => s + (r.outcome?.confidenceScore || 0), 0) / recentApplied.length;
    avgAdjustmentPercent = recentApplied.reduce((s, r) => s + Math.abs(r.outcome?.adjustmentPercent || 0), 0) / recentApplied.length;
  }

  const totalDiscountToday = promoSalesToday.reduce((s, sale) => s + (sale.quantity * sale.priceAtSale * 0.1), 0);

  // ── WAVE 3: Conditional — top event sales count (depends on activeEventsList) ──
  let topEvent = null;
  if (activeEventsList.length > 0) {
    const eventSales = await SalesEvent.countDocuments({
      productId: { $in: ownedIds },
      eventId: activeEventsList[0]._id,
      isCancelled: false,
    });
    topEvent = { name: activeEventsList[0].eventName, salesCount: eventSales };
  }

  sendSuccess(res, {
    products: { total: totalProducts, active: activeProducts, pricedToday },
    inventory: {
      critical: criticalCount, low: lowCount, normal: normalCount, high: highCount,
      totalValue: Math.round(totalValue),
    },
    pricing: {
      pendingRecommendations,
      appliedToday,
      avgConfidenceScore: parseFloat(avgConfidenceScore.toFixed(2)),
      avgAdjustmentPercent: parseFloat(avgAdjustmentPercent.toFixed(1)),
    },
    events: {
      activeEvents,
      upcomingEvents,
      totalDiscountToday: Math.round(totalDiscountToday),
      topEvent,
    },
    seasonalConfig: {
      globalEnabled: seasonalEnabled ? seasonalEnabled.value : false,
      disabledCategories: (seasonalCategories && Array.isArray(seasonalCategories.value)) ? seasonalCategories.value : [],
    },
    recentRecommendations,
  });
});

module.exports = { getDashboardStats };
