const asyncHandler = require('../middleware/asyncHandler');
const Product = require('../models/product');
const Inventory = require('../models/inventory');
const CompetitorPrice = require('../models/competitorPrice');
const PricingRecommendation = require('../models/pricingRecommendation');
const SalesEvent = require('../models/salesEvent');
const { sendSuccess, sendError } = require('../utils/apiResponse');

// @desc    List all active products belonging to the authenticated user
// @route   GET /api/v1/products
const getProducts = asyncHandler(async (req, res) => {
  const uid = req.user.uid;

  // FIXED: was Product.find({ isActive: true }) — fetched ALL users' products
  const products = await Product.find({ ownerId: uid, isActive: true }).sort({ createdAt: -1 });

  // Attach lightweight inventory data per product
  const productIds = products.map(p => p._id);
  const inventories = await Inventory.find({ productId: { $in: productIds } })
    .select('productId availableQuantity inventoryStatus coverageDays');

  const invMap = {};
  inventories.forEach(inv => { invMap[inv.productId.toString()] = inv; });

  const data = products.map(p => {
    const pObj = p.toObject();
    const inv = invMap[p._id.toString()];
    pObj.inventory = inv
      ? { availableQuantity: inv.availableQuantity, inventoryStatus: inv.inventoryStatus, coverageDays: inv.coverageDays }
      : null;
    return pObj;
  });

  sendSuccess(res, data);
});

// @desc    Get single product (ownership verified)
// @route   GET /api/v1/products/:id
const getProduct = asyncHandler(async (req, res) => {
  const uid = req.user.uid;

  // FIXED: was Product.findById — no ownership check
  const product = await Product.findOne({ _id: req.params.id, ownerId: uid });
  if (!product) return sendError(res, 'Product not found', 404);

  const inventory = await Inventory.findOne({ productId: product._id });
  const data = product.toObject();
  data.inventory = inventory
    ? { availableQuantity: inventory.availableQuantity, inventoryStatus: inventory.inventoryStatus, coverageDays: inventory.coverageDays, emaDailySales: inventory.emaDailySales, emaSalesUpdatedAt: inventory.emaSalesUpdatedAt }
    : null;

  sendSuccess(res, data);
});

// @desc    Create product — automatically assigns ownerId from JWT
// @route   POST /api/v1/products
const createProduct = asyncHandler(async (req, res) => {
  // FIXED: was Product.create(req.body) — no ownerId stored
  const product = await Product.create({
    ...req.body,
    ownerId: req.user.uid,  // always overwrite; never trust client
  });

  // Auto-create an initial inventory record
  await Inventory.create({
    productId: product._id,
    availableQuantity: req.body.initialQuantity || 0,
  });

  sendSuccess(res, product, 201);
});

// @desc    Update product (ownership enforced)
// @route   PATCH /api/v1/products/:id
const updateProduct = asyncHandler(async (req, res) => {
  const uid = req.user.uid;

  // Prevent client from reassigning ownerId
  delete req.body.ownerId;

  // FIXED: was findByIdAndUpdate — any user could update any product
  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, ownerId: uid },
    req.body,
    { returnDocument: 'after', runValidators: true }
  );
  if (!product) return sendError(res, 'Product not found', 404);
  sendSuccess(res, product);
});

// @desc    Hard delete — permanently removes product + all related data
// @route   DELETE /api/v1/products/:id
const deleteProduct = asyncHandler(async (req, res) => {
  const uid = req.user.uid;

  // Verify ownership before doing anything
  const product = await Product.findOne({ _id: req.params.id, ownerId: uid });
  if (!product) return sendError(res, 'Product not found', 404);

  const productId = product._id;

  // Cascade-delete all related documents in parallel
  await Promise.all([
    Inventory.deleteMany({ productId }),
    CompetitorPrice.deleteMany({ productId }),
    PricingRecommendation.deleteMany({ productId }),
    SalesEvent.deleteMany({ productId }),
  ]);

  // Hard delete the product itself
  await Product.deleteOne({ _id: productId });

  sendSuccess(res, { message: 'Product and all related data permanently deleted.' });
});

module.exports = { getProducts, getProduct, createProduct, updateProduct, deleteProduct };
