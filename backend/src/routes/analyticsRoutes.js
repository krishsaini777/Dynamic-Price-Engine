const express = require('express');
const router = express.Router();
const { getPriceHistory, getDemandTrends, getDemandAttribution, getEventPerformance, getEventSummary } = require('../controllers/analyticsController');

router.route('/event-summary').get(getEventSummary);
router.route('/price-history/:productId').get(getPriceHistory);
router.route('/demand-trends/:productId').get(getDemandTrends);
router.route('/demand-attribution/:productId').get(getDemandAttribution);
router.route('/event-performance/:eventId').get(getEventPerformance);

module.exports = router;
