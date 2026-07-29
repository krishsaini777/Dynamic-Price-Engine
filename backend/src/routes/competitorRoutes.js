const express = require('express');
const router = express.Router();
const { getCompetitors, addCompetitor, updateCompetitor, deleteCompetitor, getCompetitorAnalysis } = require('../controllers/competitorController');

router.route('/').post(addCompetitor);
router.route('/:productId').get(getCompetitors);
router.route('/:productId/analysis').get(getCompetitorAnalysis);
// Note: :id routes for update/delete must use a different path prefix to avoid
// ambiguity with :productId. We use /record/:id for single-record operations.
router.route('/record/:id').patch(updateCompetitor).delete(deleteCompetitor);

module.exports = router;
