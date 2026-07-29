import api from './axiosInstance';

// GET /api/v1/inventory — List all inventory with product details
export const getInventory = async () => {
  const res = await api.get('/inventory');
  return res.data;
};

// GET /api/v1/inventory/:productId — Single product inventory
export const getInventoryByProduct = async (productId) => {
  const res = await api.get(`/inventory/${productId}`);
  return res.data;
};

// POST /api/v1/inventory — Create inventory record
export const createInventory = async (data) => {
  const res = await api.post('/inventory', data);
  return res.data;
};

// PATCH /api/v1/inventory/:productId — Update quantity
export const updateInventory = async (productId, updates) => {
  const res = await api.patch(`/inventory/${productId}`, updates);
  return res.data;
};

// GET /api/v1/inventory/status/critical — List critical/low stock
export const getCriticalInventory = async () => {
  const res = await api.get('/inventory/status/critical');
  return res.data;
};
