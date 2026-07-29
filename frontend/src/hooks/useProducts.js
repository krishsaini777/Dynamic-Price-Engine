import { useState, useEffect, useCallback } from 'react';
import { getProducts, createProduct, updateProduct, deleteProduct } from '../api/productApi';

export default function useProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getProducts();
      setProducts(res.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const addProduct = async (productData) => {
    const res = await createProduct(productData);
    await fetchProducts(); // Refresh list
    return res;
  };

  const editProduct = async (id, updates) => {
    const res = await updateProduct(id, updates);
    await fetchProducts();
    return res;
  };

  const removeProduct = async (id) => {
    const res = await deleteProduct(id);
    await fetchProducts();
    return res;
  };

  return {
    products,
    loading,
    error,
    setError,
    fetchProducts,
    addProduct,
    editProduct,
    removeProduct,
  };
}
