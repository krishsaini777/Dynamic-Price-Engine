import React, { useState, useCallback } from 'react';
import { Database } from 'lucide-react';
import useInventory from '../hooks/useInventory';
import InventoryTable from '../components/inventory/InventoryTable';
import StockUpdateModal from '../components/inventory/StockUpdateModal';
import SaleRecordModal from '../components/inventory/SaleRecordModal';
import ErrorAlert from '../components/common/ErrorAlert';

const CATEGORIES = ['Electronics', 'Clothing', 'Food', 'Books', 'Home', 'Sports', 'Beauty', 'Toys', 'Automotive', 'Other'];


/* Skeleton rows for loading state */
function SkeletonTableRows({ rows = 5 }) {
  return (
    <div className="table-container">
      <div style={{ padding: '0.875rem 1rem', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          {['20%', '10%', '15%', '10%', '15%', '12%'].map((w, i) => (
            <div key={i} style={{ width: w, height: 10, borderRadius: 4, background: 'var(--bg-input)', animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: '1.5rem', padding: '0.875rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
          {['20%', '10%', '15%', '10%', '15%', '12%'].map((w, j) => (
            <div key={j} style={{ width: w, height: 14, borderRadius: 4, background: 'var(--bg-input)', animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function InventoryPage() {
  const { inventory, loading, error, setError, fetchInventory, updateStock, addSale } = useInventory();

  const [stockModalItem, setStockModalItem] = useState(null);
  const [saleModalItem, setSaleModalItem] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [saleSuccess, setSaleSuccess] = useState(false);

  const handleUpdateStock = async (productId, data) => {
    try {
      setActionError(null);
      await updateStock(productId, data);
    } catch (err) {
      setActionError(err.message);
      throw err;
    }
  };

  const handleRecordSale = async (data) => {
    try {
      setActionError(null);
      await addSale(data);
      // Show success message, auto-close after 1.5s, refetch inventory
      setSaleSuccess(true);
      setTimeout(() => {
        setSaleSuccess(false);
        setSaleModalItem(null);
        fetchInventory();
      }, 1500);
    } catch (err) {
      setActionError(err.message);
      throw err;
    }
  };

  const filtered = inventory.filter((item) => {
    if (statusFilter && item.inventoryStatus !== statusFilter) return false;
    if (categoryFilter) {
      const prodCategory = item.productId?.category || item.category || '';
      if (prodCategory !== categoryFilter) return false;
    }
    return true;
  });

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory Management</h1>
          <p className="page-subtitle">Track stock levels and record sales</p>
        </div>
      </div>

      {(error || actionError) && (
        <ErrorAlert
          message={error || actionError}
          onDismiss={() => { setError(null); setActionError(null); }}
        >
          {error && (
            <button className="btn btn-secondary btn-sm" onClick={fetchInventory} style={{ marginTop: '0.5rem' }}>
              Retry
            </button>
          )}
        </ErrorAlert>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem', alignItems: 'center' }}>
        <select
          className="select"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ maxWidth: 180 }}
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          className="select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ maxWidth: 160 }}
        >
          <option value="">All Statuses</option>
          <option value="critical">Critical</option>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
        </select>
      </div>

      {/* Results count */}
      {!loading && (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          Showing {filtered.length} item{filtered.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Table / Loading / Empty */}
      {loading ? (
        <SkeletonTableRows rows={5} />
      ) : filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: '3rem' }}>
          <Database size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
            {inventory.length === 0 ? 'No inventory records. Add products first.' : 'No items match your filters.'}
          </p>
        </div>
      ) : (
        <InventoryTable
          inventory={filtered}
          onUpdateStock={setStockModalItem}
          onRecordSale={setSaleModalItem}
        />
      )}

      <StockUpdateModal
        isOpen={!!stockModalItem}
        onClose={() => setStockModalItem(null)}
        onSubmit={handleUpdateStock}
        item={stockModalItem}
      />

      <SaleRecordModal
        isOpen={!!saleModalItem}
        onClose={() => { setSaleModalItem(null); setSaleSuccess(false); }}
        onSubmit={handleRecordSale}
        item={saleModalItem}
        saleSuccess={saleSuccess}
      />
    </div>
  );
}
