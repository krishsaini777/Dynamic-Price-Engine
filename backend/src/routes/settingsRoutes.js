const express = require('express');
const router = express.Router();
const { getSettings, updateSetting, getSeasonalSettings, toggleSeasonal, updateSeasonalCategories } = require('../controllers/settingsController');

// Seasonal convenience routes BEFORE param routes
router.route('/seasonal').get(getSeasonalSettings);
router.route('/seasonal/toggle').patch(toggleSeasonal);
router.route('/seasonal/categories').patch(updateSeasonalCategories);

router.route('/').get(getSettings);
router.route('/:key').patch(updateSetting);

module.exports = router;
