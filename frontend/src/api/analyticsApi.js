import api from './axiosInstance';

// GET /api/v1/analytics/price-history/:productId — Price change history
export const getPriceHistory = async (productId) => {
  const res = await api.get(`/analytics/price-history/${productId}`);
  return res.data;
};

// GET /api/v1/analytics/demand-trends/:productId — Demand velocity over time
export const getDemandTrends = async (productId) => {
  const res = await api.get(`/analytics/demand-trends/${productId}`);
  return res.data;
};

// GET /api/v1/analytics/demand-attribution/:productId — Organic vs promo breakdown
export const getDemandAttribution = async (productId) => {
  const res = await api.get(`/analytics/demand-attribution/${productId}`);
  return res.data;
};

// GET /api/v1/analytics/event-performance/:eventId — Event-specific metrics
export const getEventPerformance = async (eventId) => {
  const res = await api.get(`/analytics/event-performance/${eventId}`);
  return res.data;
};
