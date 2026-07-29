const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  productId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, unique: true },
  availableQuantity: { type: Number, required: true, min: 0, validate: { validator: Number.isInteger } },
  reservedQuantity:  { type: Number, default: 0, min: 0 },
  lowStockThreshold: { type: Number, default: 10 },
  reorderPoint:      { type: Number, default: 20 },

  // EMA DEMAND TRACKING — updated by background job
  emaDailySales:      { type: Number, default: null },
  emaSalesUpdatedAt:  { type: Date, default: null },
  coverageDays:       { type: Number, default: null },
  inventoryStatus:    { type: String, enum: ['critical','low','normal','high','unknown'], default: 'unknown' },

}, { timestamps: true });

// PERF: productId is the primary lookup key for all inventory queries.
// Note: unique: true on the field definition already creates a unique index,
// so we don't need a separate schema.index({ productId: 1 }) call (fixes Mongoose warning).
inventorySchema.index({ inventoryStatus: 1 });

module.exports = mongoose.model('Inventory', inventorySchema);
