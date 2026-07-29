const mongoose = require('mongoose');

const eventAnalyticsSchema = new mongoose.Schema({
  eventId:     { type: mongoose.Schema.Types.ObjectId, ref: 'PromotionalEvent', required: true },
  productId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },

  // SALES METRICS
  totalSalesDuringEvent:   { type: Number, default: 0 },
  totalRevenueDuringEvent: { type: Number, default: 0 },

  // DEMAND ATTRIBUTION
  organicSales:       { type: Number, default: 0 },
  promotionalSales:   { type: Number, default: 0 },
  demandLift:         { type: Number, default: null },

  // PRICE IMPACT
  avgPriceBeforeEvent: { type: Number, default: null },
  avgPriceDuringEvent: { type: Number, default: null },
  discountAmountTotal: { type: Number, default: 0 },

  // REVENUE ANALYSIS
  revenueWithoutEvent:  { type: Number, default: null },
  revenueWithEvent:     { type: Number, default: null },
  netRevenueImpact:     { type: Number, default: null },

  computedAt:  { type: Date, default: Date.now },
}, { timestamps: true });

eventAnalyticsSchema.index({ eventId: 1 });
eventAnalyticsSchema.index({ eventId: 1, productId: 1 }, { unique: true });

module.exports = mongoose.model('EventAnalytics', eventAnalyticsSchema);
