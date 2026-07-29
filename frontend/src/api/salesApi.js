import api from './axiosInstance';

// POST /api/v1/sales — Record a sale event
export const recordSale = async (saleData) => {
  const res = await api.post('/sales', saleData);
  return res.data;
};

// GET /api/v1/sales/:productId — Recent sales for a product
export const getProductSales = async (productId) => {
  const res = await api.get(`/sales/${productId}`);
  return res.data;
};

// GET /api/v1/sales/:productId/velocity — Computed velocity stats
export const getVelocity = async (productId) => {
  const res = await api.get(`/sales/${productId}/velocity`);
  return res.data;
};
