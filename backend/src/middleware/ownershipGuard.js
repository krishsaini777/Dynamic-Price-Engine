const Product = require('../models/product');
const asyncHandler = require('./asyncHandler');
const { sendError } = require('../utils/apiResponse');

/**
 * ownershipGuard — verifies that a product (identified by req.params.productId or req.params.id)
 * belongs to the authenticated user (req.user.uid).
 *
 * Usage: router.get('/:productId', ownershipGuard, controller)
 *
 * After this middleware passes, req.product is set so controllers can reuse the document.
 */
const ownershipGuard = asyncHandler(async (req, res, next) => {
  const productId = req.params.productId || req.params.id;

  if (!productId) return next(); // no product scope — skip

  const product = await Product.findById(productId);

  if (!product) {
    return sendError(res, 'Product not found', 404);
  }

  if (product.ownerId !== req.user.uid) {
    // Return 404 (not 403) to avoid leaking the existence of other users' products
    return sendError(res, 'Product not found', 404);
  }

  req.product = product; // attach for controllers to reuse
  next();
});

module.exports = { ownershipGuard };
