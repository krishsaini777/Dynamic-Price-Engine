const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  // OWNER — Firebase UID of the authenticated user who created this product
  ownerId:      { type: String, required: true, index: true },

  productName:  { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  sku:          { type: String, required: true, uppercase: true, trim: true },
  category:     { type: String, required: true, trim: true,
                  enum: ['Electronics', 'Clothing', 'Home', 'Sports', 'Books',
                         'Food', 'Beauty', 'Toys', 'Automotive', 'Other'] },
  description:  { type: String, default: '' },

  // PRICING FIELDS
  costPrice:    { type: Number, required: true, min: 0 },
  basePrice:    { type: Number, required: true, min: 0 },
  currentPrice: { type: Number, required: true, min: 0 },
  targetMargin: { type: Number, default: 0.15, min: 0, max: 1 },

  // TIER
  tier: {
    type: String,
    enum: ['budget', 'mid', 'premium'],
    default: 'mid'
  },

  // PRICING STRATEGY
  pricingStrategy: {
    mode:                 { type: String, enum: ['auto', 'manual'], default: 'auto' },
    maxIncreasePct:       { type: Number, default: 0.15 },
    maxDecreasePct:       { type: Number, default: 0.15 },
    minTimeBetweenChanges:{ type: Number, default: 60 },
  },

  // SEASONAL CONFIGURATION
  seasonalConfig: {
    season:       { type: String, enum: ['monsoon','summer','winter','festive','none'], default: 'none' },
    startDate:    { type: String },
    peakDate:     { type: String },
    endDate:      { type: String },
    maxBoost:     { type: Number, default: 0.12 },
  },

  // LIFECYCLE
  isActive:     { type: Boolean, default: true },
  lastPricedAt: { type: Date, default: null },

}, { timestamps: true });

// INDEXES
productSchema.index({ ownerId: 1, isActive: 1 }); // primary per-user query
productSchema.index({ ownerId: 1, category: 1 });
productSchema.index({ lastPricedAt: 1 });

module.exports = mongoose.model('Product', productSchema);
