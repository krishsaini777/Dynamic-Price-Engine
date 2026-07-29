import { useState, useEffect, useCallback } from 'react';
import { getInventory, updateInventory } from '../api/inventoryApi';
import { recordSale } from '../api/salesApi';

export default function useInventory() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchInventory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getInventory();
      setInventory(res.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const updateStock = async (productId, updates) => {
    const res = await updateInventory(productId, updates);
    const updated = res.data;

    // ROOT CAUSE FIX: Use optimistic update from the PATCH response instead of a full refetch.
    // The backend now returns the fully-recalculated document (qty + coverage + status).
    // This avoids a loading flash AND ensures stale data is never shown.
    if (updated && updated._id) {
      setInventory((prev) =>
        prev.map((item) => (item._id === updated._id ? updated : item))
      );
    } else {
      // Fallback: if response shape is unexpected, do a full refetch
      await fetchInventory();
    }
    return res;
  };

  const addSale = async (saleData) => {
    const res = await recordSale(saleData);
    // After a sale, refetch to get updated qty + coverage (sale also modifies inventory)
    await fetchInventory();
    return res;
  };

  return {
    inventory,
    loading,
    error,
    setError,
    fetchInventory,
    updateStock,
    addSale,
  };
}
