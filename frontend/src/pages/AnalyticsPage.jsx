import React, { useState, useEffect } from 'react';
import { getProducts } from '../api/productApi';
import ErrorAlert from '../components/common/ErrorAlert';
import PriceHistoryChart from '../components/analytics/PriceHistoryChart';
import DemandTrendChart from '../components/analytics/DemandTrendChart';
import DemandAttributionChart from '../components/analytics/DemandAttributionChart';
import EventPerformanceCard from '../components/analytics/EventPerformanceCard';

export default function AnalyticsPage() {
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await getProducts();
        setProducts(res.data || []);
        if (res.data?.length > 0) {
          setSelectedProductId(res.data[0]._id);
        }
      } catch (err) {
        setError(err.message);
      }
    })();
  }, []);

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Product performance, demand attribution, and event ROI</p>
        </div>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {/* Product Selector */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Select Product:</label>
        <select
          className="select"
          value={selectedProductId}
          onChange={(e) => setSelectedProductId(e.target.value)}
          style={{ maxWidth: 300 }}
        >
          <option value="">— Choose a product —</option>
          {products.map((p) => (
            <option key={p._id} value={p._id}>{p.productName} ({p.sku})</option>
          ))}
        </select>
      </div>

      {!selectedProductId ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <p>Select a product to view analytics.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem' }}>
          <PriceHistoryChart productId={selectedProductId} />
          <DemandTrendChart productId={selectedProductId} />
          <DemandAttributionChart productId={selectedProductId} />
          <EventPerformanceCard key={selectedProductId} />
        </div>
      )}
    </div>
  );
}
