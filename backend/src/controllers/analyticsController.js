const mongoose = require('mongoose');
const asyncHandler = require('../middleware/asyncHandler');
const PricingRecommendation = require('../models/pricingRecommendation');
const SalesEvent = require('../models/salesEvent');
const EventAnalytics = require('../models/eventAnalytics');
const Product = require('../models/product');
const PromotionalEvent = require('../models/promotionalEvent');
const { sendSuccess, sendError } = require('../utils/apiResponse');

// Helper — verify the product belongs to the current user
async function verifyProductOwnership(productId, uid) {
  const product = await Product.findOne({ _id: productId, ownerId: uid });
  return product;
}

// @desc    Price over time chart data (ownership enforced)
// @route   GET /api/v1/analytics/price-history/:productId
const getPriceHistory = asyncHandler(async (req, res) => {
  const uid = req.user.uid;

  // FIXED: no ownership check previously
  const product = await verifyProductOwnership(req.params.productId, uid);
  if (!product) return sendError(res, 'Product not found', 404);

  const recommendations = await PricingRecommendation.find({
    productId: req.params.productId,
    ownerId: uid,
    status: 'APPLIED',
  }).sort({ appliedAt: 1 }).select('appliedAt outcome.recommendedPrice inputSnapshot.currentPrice');

  const data = recommendations.map(r => ({
    date: r.appliedAt,
    previousPrice: r.inputSnapshot?.currentPrice,
    newPrice: r.outcome?.recommendedPrice,
  }));

  sendSuccess(res, data);
});

// @desc    Demand velocity over time (ownership enforced)
// @route   GET /api/v1/analytics/demand-trends/:productId
const getDemandTrends = asyncHandler(async (req, res) => {
  const uid = req.user.uid;

  // FIXED: no ownership check previously
  const product = await verifyProductOwnership(req.params.productId, uid);
  if (!product) return sendError(res, 'Product not found', 404);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const productObjId = new mongoose.Types.ObjectId(req.params.productId);

  const dailySales = await SalesEvent.aggregate([
    { $match: { productId: productObjId, isCancelled: false, soldAt: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$soldAt' } },
        totalQuantity: { $sum: '$quantity' },
        organicQuantity: { $sum: { $cond: [{ $eq: ['$isPromotional', false] }, '$quantity', 0] } },
        promoQuantity: { $sum: { $cond: [{ $eq: ['$isPromotional', true] }, '$quantity', 0] } },
        totalRevenue: { $sum: { $multiply: ['$quantity', '$priceAtSale'] } },
      }
    },
    { $sort: { _id: 1 } }
  ]);

  sendSuccess(res, dailySales);
});

// @desc    Organic vs promotional split (ownership enforced)
// @route   GET /api/v1/analytics/demand-attribution/:productId
const getDemandAttribution = asyncHandler(async (req, res) => {
  const uid = req.user.uid;

  // FIXED: no ownership check previously
  const product = await verifyProductOwnership(req.params.productId, uid);
  if (!product) return sendError(res, 'Product not found', 404);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const productObjId = new mongoose.Types.ObjectId(req.params.productId);

  // PERF: Replace SalesEvent.find() + JS forEach reduce with a MongoDB $group aggregation.
  // Previously loaded ALL sale documents into Node memory (O(N) RAM).
  // Now the DB computes all sums server-side and returns a single result row.
  const [agg] = await SalesEvent.aggregate([
    {
      $match: {
        productId: productObjId,
        isCancelled: false,
        soldAt: { $gte: thirtyDaysAgo },
      },
    },
    {
      $group: {
        _id: null,
        totalSales: { $sum: '$quantity' },
        organicSales: {
          $sum: { $cond: [{ $eq: ['$isPromotional', false] }, '$quantity', 0] },
        },
        promotionalSales: {
          $sum: { $cond: [{ $eq: ['$isPromotional', true] }, '$quantity', 0] },
        },
        organicRevenue: {
          $sum: {
            $cond: [
              { $eq: ['$isPromotional', false] },
              { $multiply: ['$quantity', '$priceAtSale'] },
              0,
            ],
          },
        },
        promotionalRevenue: {
          $sum: {
            $cond: [
              { $eq: ['$isPromotional', true] },
              { $multiply: ['$quantity', '$priceAtSale'] },
              0,
            ],
          },
        },
      },
    },
  ]);

  const totalSales = agg?.totalSales || 0;
  const organicSales = agg?.organicSales || 0;
  const promotionalSales = agg?.promotionalSales || 0;
  const organicRevenue = agg?.organicRevenue || 0;
  const promotionalRevenue = agg?.promotionalRevenue || 0;

  sendSuccess(res, {
    productId: req.params.productId,
    period: 'last_30_days',
    totalSales,
    organicSales,
    promotionalSales,
    organicPercentage: totalSales > 0 ? parseFloat((organicSales / totalSales * 100).toFixed(1)) : 100,
    promotionalPercentage: totalSales > 0 ? parseFloat((promotionalSales / totalSales * 100).toFixed(1)) : 0,
    organicRevenue: Math.round(organicRevenue),
    promotionalRevenue: Math.round(promotionalRevenue),
  });
});

// @desc    Event metrics (ownership enforced)
// @route   GET /api/v1/analytics/event-performance/:eventId
const getEventPerformance = asyncHandler(async (req, res) => {
  const uid = req.user.uid;

  // FIXED: no ownership check on the event previously
  const event = await PromotionalEvent.findOne({ _id: req.params.eventId, ownerId: uid });
  if (!event) return sendError(res, 'Event not found', 404);

  const analytics = await EventAnalytics.find({ eventId: req.params.eventId })
    .populate('productId', 'productName sku currentPrice');
  sendSuccess(res, analytics);
});

// @desc    Aggregate event performance (user-scoped)
// @route   GET /api/v1/analytics/event-summary
const getEventSummary = asyncHandler(async (req, res) => {
  const uid = req.user.uid;

  // Get all event IDs belonging to this user
  const userEvents = await PromotionalEvent.find({ ownerId: uid }).select('_id');
  const eventIds = userEvents.map(e => e._id);

  // FIXED: was EventAnalytics.aggregate with no filter — counted all users' event data
  const summary = await EventAnalytics.aggregate([
    { $match: { eventId: { $in: eventIds } } },
    {
      $group: {
        _id: null,
        totalSales: { $sum: '$totalSalesDuringEvent' },
        totalRevenue: { $sum: '$totalRevenueDuringEvent' },
        totalDiscount: { $sum: '$discountAmountTotal' },
        avgLift: { $avg: '$demandLift' },
      }
    }
  ]);
  sendSuccess(res, summary.length > 0 ? summary[0] : { totalSales: 0, totalRevenue: 0, totalDiscount: 0, avgLift: null });
});

module.exports = { getPriceHistory, getDemandTrends, getDemandAttribution, getEventPerformance, getEventSummary };
