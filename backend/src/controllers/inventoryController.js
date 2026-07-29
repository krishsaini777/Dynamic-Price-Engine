const asyncHandler = require('../middleware/asyncHandler');
const Inventory = require('../models/inventory');
const Product = require('../models/product');
const { sendSuccess, sendError } = require('../utils/apiResponse');

/**
 * computeCoverageAndStatus — Single source of truth for inventory coverage metrics.
 *
 * Status thresholds (canonical — must match CoverageMeter.jsx and emaService.js):
 *   0 qty          → 0d coverage → CRITICAL
 *   <= 3 days      → CRITICAL
 *   <= 7 days      → LOW
 *   <= 21 days     → NORMAL
 *   > 21 days      → HIGH
 *   no EMA data    → null coverage → UNKNOWN
 *
 * @param {number} availableQuantity
 * @param {number|null} emaDailySales
 * @returns {{ coverageDays: number|null, inventoryStatus: string }}
 */
function computeCoverageAndStatus(availableQuantity, emaDailySales) {
  if (availableQuantity === 0) {
    return { coverageDays: 0, inventoryStatus: 'critical' };
  }
  if (!emaDailySales || emaDailySales <= 0) {
    return { coverageDays: null, inventoryStatus: 'unknown' };
  }
  const coverageDays = parseFloat((availableQuantity / emaDailySales).toFixed(1));
  let inventoryStatus;
  if (coverageDays <= 3)       inventoryStatus = 'critical';
  else if (coverageDays <= 7)  inventoryStatus = 'low';
  else if (coverageDays <= 21) inventoryStatus = 'normal';
  else                         inventoryStatus = 'high';
  return { coverageDays, inventoryStatus };
}


// Helper: get all product IDs that belong to the current user
async function getOwnedProductIds(uid) {
  // PERF: Add .lean() — we only need raw _id values, not full Mongoose documents.
  // Skips document hydration overhead for what can be a large product list.
  const products = await Product.find({ ownerId: uid, isActive: true }).select('_id').lean();
  return products.map(p => p._id);
}

// @desc    List all inventory — only for the authenticated user's products
// @route   GET /api/v1/inventory
const getInventories = asyncHandler(async (req, res) => {
  const uid = req.user.uid;

  // FIXED: was Inventory.find() — returned ALL users' inventory
  const ownedIds = await getOwnedProductIds(uid);
  const inventories = await Inventory.find({ productId: { $in: ownedIds } })
    .populate('productId', 'productName currentPrice category sku tier');
  sendSuccess(res, inventories);
});

// @desc    Single product inventory — ownership enforced
// @route   GET /api/v1/inventory/:productId
const getInventory = asyncHandler(async (req, res) => {
  const uid = req.user.uid;

  // FIXED: was Inventory.findOne({ productId }) — no ownership check
  const product = await Product.findOne({ _id: req.params.productId, ownerId: uid });
  if (!product) return sendError(res, 'Product not found', 404);

  const inventory = await Inventory.findOne({ productId: req.params.productId })
    .populate('productId', 'productName currentPrice category sku tier');
  if (!inventory) return sendError(res, 'Inventory not found for this product', 404);
  sendSuccess(res, inventory);
});

// @desc    Create inventory record
// @route   POST /api/v1/inventory
const createInventory = asyncHandler(async (req, res) => {
  const uid = req.user.uid;

  // Verify the target product belongs to this user
  const product = await Product.findOne({ _id: req.body.productId, ownerId: uid });
  if (!product) return sendError(res, 'Product not found', 404);

  const inventory = await Inventory.create(req.body);
  sendSuccess(res, inventory, 201);
});

// @desc    Update quantity — ownership enforced via product lookup
// @route   PATCH /api/v1/inventory/:productId
const updateInventory = asyncHandler(async (req, res) => {
  const uid = req.user.uid;

  const product = await Product.findOne({ _id: req.params.productId, ownerId: uid });
  if (!product) return sendError(res, 'Product not found', 404);

  // Step 1: Fetch current inventory to get emaDailySales for coverage recalculation
  const existing = await Inventory.findOne({ productId: req.params.productId });
  if (!existing) return sendError(res, 'Inventory not found for this product', 404);

  // Step 2: Determine new quantity
  const newQty = req.body.availableQuantity !== undefined
    ? req.body.availableQuantity
    : existing.availableQuantity;

  // Step 3: Recalculate coverage and status from scratch
  // ROOT CAUSE FIX: previously req.body was written verbatim — coverage/status never updated.
  const emaDailySales = existing.emaDailySales;
  const { coverageDays, inventoryStatus } = computeCoverageAndStatus(newQty, emaDailySales);

  // Step 4: Build update object — merge any other allowed fields from req.body, then apply derived fields
  const updateFields = {
    ...req.body,
    availableQuantity: newQty,
    coverageDays,
    inventoryStatus,
  };

  const inventory = await Inventory.findOneAndUpdate(
    { productId: req.params.productId },
    updateFields,
    { new: true, runValidators: true }
  ).populate('productId', 'productName currentPrice category sku tier');

  sendSuccess(res, inventory);
});

// @desc    List critical/low stock products — only current user's products
// @route   GET /api/v1/inventory/status/critical
const getCriticalInventory = asyncHandler(async (req, res) => {
  const uid = req.user.uid;

  // FIXED: was Inventory.find({ inventoryStatus: { $in: [...] } }) — no ownership filter
  const ownedIds = await getOwnedProductIds(uid);
  const inventories = await Inventory.find({
    productId: { $in: ownedIds },
    inventoryStatus: { $in: ['critical', 'low'] },
  }).populate('productId', 'productName currentPrice category sku tier');
  sendSuccess(res, inventories);
});

module.exports = { getInventories, getInventory, createInventory, updateInventory, getCriticalInventory };
