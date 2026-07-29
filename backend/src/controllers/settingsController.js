const asyncHandler = require('../middleware/asyncHandler');
const Settings = require('../models/settings');
const { sendSuccess, sendError } = require('../utils/apiResponse');

// @desc    Get all settings for the authenticated user
// @route   GET /api/v1/settings
const getSettings = asyncHandler(async (req, res) => {
  const uid = req.user.uid;

  // FIXED: was Settings.find({}) — returned ALL users' settings
  const settings = await Settings.find({ ownerId: uid });
  sendSuccess(res, settings);
});

// @desc    Update a setting value (user-scoped)
// @route   PATCH /api/v1/settings/:key
const updateSetting = asyncHandler(async (req, res) => {
  const uid = req.user.uid;
  const { value } = req.body;
  if (value === undefined) return sendError(res, 'value is required', 400);

  // FIXED: was findOneAndUpdate({ key }) — any user could overwrite global settings
  const setting = await Settings.findOneAndUpdate(
    { key: req.params.key, ownerId: uid },
    { value },
    { new: true, runValidators: true, upsert: true }
  );
  sendSuccess(res, setting);
});

// @desc    Get seasonal toggle config (user-scoped)
// @route   GET /api/v1/settings/seasonal
const getSeasonalSettings = asyncHandler(async (req, res) => {
  const uid = req.user.uid;

  // PERF: Fetch both settings in parallel — they are independent reads.
  // Previously sequential: categories query waited for enabled-flag query (~50-100ms wasted).
  const [enabledSetting, categoriesSetting] = await Promise.all([
    Settings.findOne({ key: 'seasonalPricingEnabled', ownerId: uid }),
    Settings.findOne({ key: 'seasonalDisabledCategories', ownerId: uid }),
  ]);
  const enabled = enabledSetting ? enabledSetting.value : false;
  const categories = (categoriesSetting && Array.isArray(categoriesSetting.value)) ? categoriesSetting.value : [];

  sendSuccess(res, {
    seasonalPricingEnabled: enabled,
    seasonalDisabledCategories: categories,
    summary: `Seasonal pricing is ${enabled ? 'ON' : 'OFF'} globally${categories.length > 0 ? `, disabled for: ${categories.join(', ')}` : ''}`,
  });
});

// @desc    Toggle seasonal ON/OFF (user-scoped)
// @route   PATCH /api/v1/settings/seasonal/toggle
const toggleSeasonal = asyncHandler(async (req, res) => {
  const uid = req.user.uid;
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') return sendError(res, 'enabled must be a boolean', 400);

  // FIXED: was findOneAndUpdate({ key }) — no ownerId filter; upsert created global doc
  const setting = await Settings.findOneAndUpdate(
    { key: 'seasonalPricingEnabled', ownerId: uid },
    { value: enabled },
    { new: true, upsert: true }
  );
  sendSuccess(res, { seasonalPricingEnabled: setting.value });
});

// @desc    Update disabled categories list (user-scoped)
// @route   PATCH /api/v1/settings/seasonal/categories
const updateSeasonalCategories = asyncHandler(async (req, res) => {
  const uid = req.user.uid;
  const { categories } = req.body;
  if (!Array.isArray(categories)) return sendError(res, 'categories must be an array', 400);

  // FIXED: was findOneAndUpdate({ key }) — no ownerId filter
  const setting = await Settings.findOneAndUpdate(
    { key: 'seasonalDisabledCategories', ownerId: uid },
    { value: categories },
    { new: true, upsert: true }
  );
  sendSuccess(res, { seasonalDisabledCategories: setting.value });
});

module.exports = { getSettings, updateSetting, getSeasonalSettings, toggleSeasonal, updateSeasonalCategories };
