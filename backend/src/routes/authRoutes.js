const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../middleware/asyncHandler');
const Settings = require('../models/settings');
const Product = require('../models/product');
const { seedDummyDataForUser } = require('../services/seedService');

router.get('/me', protect, asyncHandler(async (req, res) => {
  const uid = req.user.uid;

  const productCount = await Product.countDocuments({ ownerId: uid, isActive: true });

  if (productCount === 0) {
    await Settings.deleteOne({ ownerId: uid, key: 'hasSeededDummyData' });
    await seedDummyDataForUser(uid);
    await Settings.updateOne(
      { ownerId: uid, key: 'hasSeededDummyData' },
      { $set: { value: true } },
      { upsert: true },
    );
  }

  sendSuccess(res, req.user);
}));

router.post('/seed-presentation', protect, asyncHandler(async (req, res) => {
  const uid = req.user.uid;
  await seedDummyDataForUser(uid);
  await Settings.updateOne(
    { ownerId: uid, key: 'hasSeededDummyData' },
    { $set: { value: true } },
    { upsert: true },
  );
  sendSuccess(res, { message: 'Presentation data seeded successfully.' });
}));

module.exports = router;
