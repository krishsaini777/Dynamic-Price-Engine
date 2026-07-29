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
    setImmediate(async () => {
      try {
        await Settings.deleteOne({ ownerId: uid, key: 'hasSeededDummyData' });
        await seedDummyDataForUser(uid);
        await Settings.updateOne(
          { ownerId: uid, key: 'hasSeededDummyData' },
          { $set: { value: true } },
          { upsert: true },
        );
        console.log(`[Auth] Background seed complete for ${uid}`);
      } catch (err) {
        console.error(`[Auth] Background seed failed for ${uid}:`, err.message);
      }
    });
  }

  sendSuccess(res, req.user);
}));

router.post('/seed-presentation', protect, asyncHandler(async (req, res) => {
  const uid = req.user.uid;

  setImmediate(async () => {
    try {
      await seedDummyDataForUser(uid);
      await Settings.updateOne(
        { ownerId: uid, key: 'hasSeededDummyData' },
        { $set: { value: true } },
        { upsert: true },
      );
      console.log(`[Auth] Forced background seed complete for ${uid}`);
    } catch (err) {
      console.error(`[Auth] Forced background seed failed for ${uid}:`, err.message);
    }
  });

  sendSuccess(res, { message: 'Seeding started in background. Refresh your dashboard in 10 seconds.' });
}));

module.exports = router;
