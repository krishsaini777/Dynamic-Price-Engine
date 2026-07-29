const express = require("express");
const router = express.Router();
const asyncHandler = require("../middleware/asyncHandler");
const {
  calculatePrice,
  applyRecommendation,
  rejectRecommendation,
  getRecommendations,
  getProductRecommendations,
  recalculateAll,
  getRecommendationById,
  // NEW: ML-specific endpoints (Phase 8 — Hybrid Upgrade)
  getModelStatus,
  getPredictionLogs,
  getProductPredictionLogs,
} = require("../controllers/pricingController");

// ── Existing routes (UNCHANGED) ───────────────────────────────────────────────
router.post("/calculate", asyncHandler(calculatePrice));
router.post("/recalculate-all", asyncHandler(recalculateAll));

router.patch("/:decisionId/apply", asyncHandler(applyRecommendation));
router.patch("/:decisionId/reject", asyncHandler(rejectRecommendation));

router.get("/recommendations/:productId", asyncHandler(getProductRecommendations));
router.get("/recommendations", asyncHandler(getRecommendations));
router.get("/decision/:id", asyncHandler(getRecommendationById));

// ── NEW: ML / Hybrid routes ───────────────────────────────────────────────────
// GET /api/v1/pricing/model-status  — Is XGBoost loaded? What version?
router.get("/model-status", asyncHandler(getModelStatus));

// GET /api/v1/pricing/prediction-logs            — User's full ML prediction history
// GET /api/v1/pricing/prediction-logs/:productId — Per-product ML prediction logs
router.get("/prediction-logs/:productId", asyncHandler(getProductPredictionLogs));
router.get("/prediction-logs", asyncHandler(getPredictionLogs));

module.exports = router;


