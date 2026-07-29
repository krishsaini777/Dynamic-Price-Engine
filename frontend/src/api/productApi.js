import api from './axiosInstance';

// GET /api/v1/products — List all active products
export const getProducts = async () => {
  const res = await api.get('/products');
  return res.data; // { success, count, data: [...] }
};

// GET /api/v1/products/:id — Single product with inventory
export const getProduct = async (id) => {
  const res = await api.get(`/products/${id}`);
  return res.data;
};

// POST /api/v1/products — Create product
export const createProduct = async (productData) => {
  const res = await api.post('/products', productData);
  return res.data;
};

// PATCH /api/v1/products/:id — Update product fields
export const updateProduct = async (id, updates) => {
  const res = await api.patch(`/products/${id}`, updates);
  return res.data;
};

// DELETE /api/v1/products/:id — Soft delete (isActive: false)
export const deleteProduct = async (id) => {
  const res = await api.delete(`/products/${id}`);
  return res.data;
};
