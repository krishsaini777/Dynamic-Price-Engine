const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  // OWNER — Firebase UID. Each user has their own settings namespace.
  ownerId:     { type: String, required: true },
  key:         { type: String, required: true },
  value:       { type: mongoose.Schema.Types.Mixed, required: true },
  description: { type: String },
}, { timestamps: true });

// Compound unique: one key per user
settingsSchema.index({ key: 1, ownerId: 1 }, { unique: true });

module.exports = mongoose.model('Settings', settingsSchema);
