import React, { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';

/**
 * PricingForm — Product selector + Calculate button.
 * On Day 2 this is a skeleton; Day 3 wires it to the real API.
 */
export default function PricingForm({ products, onCalculate, loading, initialProductId }) {
  const [selectedProductId, setSelectedProductId] = useState(initialProductId || '');

  useEffect(() => {
    if (initialProductId) {
      setSelectedProductId(initialProductId);
    }
  }, [initialProductId]);

  // Auto-select first product when list arrives
  useEffect(() => {
    if (products?.length > 0) {
      if (!selectedProductId || !products.find((p) => p._id === selectedProductId)) {
        setSelectedProductId(products[0]._id);
      }
    }
  }, [products, selectedProductId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedProductId) return;
    onCalculate(selectedProductId);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="card" style={{ padding: '1.25rem' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          Calculate Price
        </p>

        <div style={{ marginBottom: '1rem' }}>
          <label className="label">Select Product</label>
          <select
            className="select"
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            disabled={!products?.length}
          >
            {!products?.length && <option value="">No products available</option>}
            {products?.map((p) => (
              <option key={p._id} value={p._id}>
                {p.productName} ({p.sku}) — ₹{p.currentPrice?.toLocaleString('en-IN')}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading || !selectedProductId}
          style={{ width: '100%' }}
        >
          <Zap size={16} />
          {loading ? 'Calculating...' : 'Run Pricing Engine'}
        </button>
      </div>
    </form>
  );
}
