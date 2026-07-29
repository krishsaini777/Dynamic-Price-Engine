import api from './axiosInstance';

// POST /api/v1/pricing/calculate — Run pricing engine for a product
export const calculatePrice = async (productId, triggeredBy = 'manual') => {
  const res = await api.post('/pricing/calculate', {
    productId,
    triggeredBy,
    referenceDate: new Date().toISOString(),
  });
  return res.data;
};

// PATCH /api/v1/pricing/:decisionId/apply — Apply a pending recommendation
export const applyDecision = async (decisionId, mode) => {
  const res = await api.patch(`/pricing/${decisionId}/apply`, {
    applyWithDiscount: mode === 'with_discount',
  });
  return res.data;
};

// PATCH /api/v1/pricing/:decisionId/reject — Reject a recommendation
export const rejectDecision = async (decisionId) => {
  const res = await api.patch(`/pricing/${decisionId}/reject`);
  return res.data;
};

// GET /api/v1/pricing/recommendations — List all recommendations
export const getRecommendations = async (params = {}) => {
  const res = await api.get('/pricing/recommendations', { params });
  return res.data;
};

// GET /api/v1/pricing/recommendations/:productId — Product-specific history
export const getProductRecommendations = async (productId) => {
  const res = await api.get(`/pricing/recommendations/${productId}`);
  return res.data;
};

// GET /api/v1/pricing/decision/:decisionId — Get specific decision
export const getDecisionById = async (decisionId) => {
  const res = await api.get(`/pricing/decision/${decisionId}`);
  return res.data;
};

// POST /api/v1/pricing/recalculate-all — Trigger batch recalculation
export const recalculateAll = async () => {
  const res = await api.post('/pricing/recalculate-all');
  return res.data;
};

// ── NEW: ML / Hybrid API Endpoints ──────────────────────────────────────────

export const getModelStatus = async () => {
  const res = await api.get('/pricing/model-status');
  return res.data;
};

export const getPredictionLogs = async (params = {}) => {
  const res = await api.get('/pricing/prediction-logs', { params });
  return res.data;
};

export const getProductPredictionLogs = async (productId, params = {}) => {
  const res = await api.get(`/pricing/prediction-logs/${productId}`, { params });
  return res.data;
};
