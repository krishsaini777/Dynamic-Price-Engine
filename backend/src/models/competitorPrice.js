const mongoose = require('mongoose');

const competitorPriceSchema = new mongoose.Schema({
  productId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  competitorName: { type: String, required: true, trim: true },
  competitorPrice:{ type: Number, required: true, min: 0 },
  competitorUrl:  { type: String, default: '' },
  isOutlier:      { type: Boolean, default: false },
  stalenessScore: { type: Number, default: 1.0 },
  recordedAt:     { type: Date, default: Date.now },
}, { timestamps: true });

competitorPriceSchema.index({ productId: 1, updatedAt: -1 });
competitorPriceSchema.index({ updatedAt: 1 });

// TTL: auto-delete competitor records older than 30 days
competitorPriceSchema.index({ recordedAt: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('CompetitorPrice', competitorPriceSchema);