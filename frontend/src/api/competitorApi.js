import api from './axiosInstance';

// GET /api/v1/competitors/:productId — List competitor prices for a product
export const getCompetitors = async (productId) => {
  const res = await api.get(`/competitors/${productId}`);
  return res.data;
};

// POST /api/v1/competitors — Add a competitor price
export const createCompetitor = async (data) => {
  const res = await api.post('/competitors', data);
  return res.data;
};

// PATCH /api/v1/competitors/record/:id — Update competitor price
export const updateCompetitor = async (id, updates) => {
  const res = await api.patch(`/competitors/record/${id}`, updates);
  return res.data;
};

// DELETE /api/v1/competitors/record/:id — Remove competitor price
export const deleteCompetitor = async (id) => {
  const res = await api.delete(`/competitors/record/${id}`);
  return res.data;
};

// GET /api/v1/competitors/:productId/analysis — Gap analysis result
export const getGapAnalysis = async (productId) => {
  const res = await api.get(`/competitors/${productId}/analysis`);
  return res.data;
};
