const express = require('express');
const router = express.Router();
const { recordSale, getProductSales, getVelocity } = require('../controllers/salesController');

router.route('/').post(recordSale);
router.route('/:productId').get(getProductSales);
router.route('/:productId/velocity').get(getVelocity);

module.exports = router;
