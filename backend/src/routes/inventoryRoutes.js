const express = require('express');
const router = express.Router();
const { getInventories, getInventory, createInventory, updateInventory, getCriticalInventory } = require('../controllers/inventoryController');

// Static path BEFORE param path
router.route('/status/critical').get(getCriticalInventory);
router.route('/').get(getInventories).post(createInventory);
router.route('/:productId').get(getInventory).patch(updateInventory);

module.exports = router;
