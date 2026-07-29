const mongoose = require('mongoose');

const promotionalEventSchema = new mongoose.Schema({
  // OWNER — Firebase UID of the user who created this event
  ownerId:      { type: String, required: true },

  // IDENTITY
  eventName:    { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
  eventType:    {
    type: String, required: true,
    enum: ['weekend_sale', 'festival_sale', 'anniversary_sale', 'flash_sale',
           'clearance_sale', 'product_specific', 'category_sale', 'custom']
  },
  description:  { type: String, default: '' },

  // SCHEDULING
  startDate:    { type: Date, required: true },
  endDate:      { type: Date, required: true },

  // LIFECYCLE STATUS
  status: {
    type: String,
    enum: ['DRAFT', 'SCHEDULED', 'ACTIVE', 'INACTIVE', 'EXPIRED'],
    default: 'DRAFT'
  },

  // PRIORITY (1 = highest, 10 = lowest)
  priority:     { type: Number, default: 5, min: 1, max: 10 },

  // DISCOUNT CONFIGURATION
  discountType: {
    type: String, required: true,
    enum: ['percentage', 'flat_amount', 'fixed_price']
  },
  discountValue: { type: Number, required: true, min: 0 },

  // TARGETING
  targetType:   {
    type: String, required: true,
    enum: ['all_products', 'specific_products', 'specific_categories']
  },
  targetProducts:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  targetCategories: [{ type: String }],

  // CONSTRAINTS
  maxDiscountCap:     { type: Number, default: null },
  minFinalPrice:      { type: Number, default: null },
  respectProfitFloor: { type: Boolean, default: true },

  // RECURRENCE
  isRecurring:      { type: Boolean, default: false },
  recurrencePattern: {
    type: String,
    enum: ['weekly', 'biweekly', 'monthly', null],
    default: null
  },
  recurrenceDays:   [{ type: Number, min: 0, max: 6 }],

}, { timestamps: true });

// INDEXES
promotionalEventSchema.index({ ownerId: 1, status: 1 });
promotionalEventSchema.index({ ownerId: 1, startDate: 1, endDate: 1 });
promotionalEventSchema.index({ startDate: 1, endDate: 1 });
promotionalEventSchema.index({ targetProducts: 1 });
promotionalEventSchema.index({ targetCategories: 1 });
promotionalEventSchema.index({ status: 1, startDate: 1, endDate: 1 });

// VALIDATION: endDate must be after startDate
promotionalEventSchema.pre('validate', function () {
  if (this.endDate <= this.startDate) {
    throw new Error('endDate must be after startDate');
  }
});

module.exports = mongoose.model('PromotionalEvent', promotionalEventSchema);
