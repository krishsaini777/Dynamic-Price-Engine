const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../middleware/asyncHandler');
const Settings = require('../models/settings');
const { seedDummyDataForUser } = require('../services/seedService');

// ── GET /api/v1/auth/me — return current Firebase user info ─
// The frontend calls this right after Firebase login.
// We intercept this to seed dummy data for brand new users.
router.get('/me', protect, asyncHandler(async (req, res) => {
  const uid = req.user.uid;

  // Check if this user has already been seeded
  const seeded = await Settings.findOne({ ownerId: uid, key: 'hasSeededDummyData' });
  
  if (!seeded) {
    // Brand new user — seed dummy data so their dashboard isn't empty!
    await seedDummyDataForUser(uid);
    // Mark as seeded so it never runs again for this user
    await Settings.create({ ownerId: uid, key: 'hasSeededDummyData', value: true });
  }

  sendSuccess(res, req.user);
}));

module.exports = router;
