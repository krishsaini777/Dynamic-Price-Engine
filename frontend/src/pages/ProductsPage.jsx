import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, X, Search, Package } from 'lucide-react';
import useProducts from '../hooks/useProducts';
import ProductTable from '../components/products/ProductTable';
import ProductForm from '../components/products/ProductForm';
import Modal from '../components/common/Modal';
import ErrorAlert from '../components/common/ErrorAlert';

const CATEGORIES = ['Electronics', 'Clothing', 'Food', 'Books', 'Home', 'Sports', 'Beauty', 'Toys', 'Other'];

/* Skeleton rows for loading state */
function SkeletonTableRows({ rows = 5 }) {
  return (
    <div className="table-container">
      <div style={{ padding: '0.875rem 1rem', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          {['12%', '25%', '12%', '10%', '12%', '8%', '10%'].map((w, i) => (
            <div key={i} style={{ width: w, height: 10, borderRadius: 4, background: 'var(--bg-input)', animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: '1.5rem', padding: '0.875rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
          {['12%', '25%', '12%', '10%', '12%', '8%', '10%'].map((w, j) => (
            <div key={j} style={{ width: w, height: 14, borderRadius: 4, background: 'var(--bg-input)', animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function ProductsPage() {
  const { products, loading, error, setError, fetchProducts, addProduct, editProduct, removeProduct } = useProducts();
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const debounceRef = useRef(null);

  // Debounce search (300ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchTerm]);

  const handleCreate = () => {
    setEditingProduct(null);
    setFormOpen(true);
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormOpen(true);
  };

  const handleFormSubmit = async (data) => {
    try {
      setActionError(null);
      if (editingProduct) {
        await editProduct(editingProduct._id, data);
      } else {
        await addProduct(data);
      }
    } catch (err) {
      setActionError(err.message);
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setActionError(null);
      await removeProduct(deleteTarget._id);
      setDeleteTarget(null);
    } catch (err) {
      setActionError(err.message);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setCategoryFilter('');
    setTierFilter('');
  };

  const hasFilters = searchTerm || categoryFilter || tierFilter;

  // Apply filters client-side (search is debounced, category/tier immediate)
  const filtered = products.filter((p) => {
    if (debouncedSearch && !p.productName.toLowerCase().includes(debouncedSearch.toLowerCase()) && !p.sku.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (tierFilter && p.tier !== tierFilter) return false;
    return true;
  });

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">{products.length} products in catalog</p>
        </div>
        <button className="btn btn-primary" onClick={handleCreate}>
          <Plus size={16} /> Add Product
        </button>
      </div>

      {(error || actionError) && (
        <ErrorAlert message={error || actionError} onDismiss={() => { setError(null); setActionError(null); }}>
          {error && (
            <button className="btn btn-secondary btn-sm" onClick={fetchProducts} style={{ marginTop: '0.5rem' }}>
              Retry
            </button>
          )}
        </ErrorAlert>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', maxWidth: 280, flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            placeholder="Search by name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2rem' }}
          />
        </div>
        <select className="select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="select" value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} style={{ maxWidth: 140 }}>
          <option value="">All Tiers</option>
          <option value="budget">Budget</option>
          <option value="mid">Mid</option>
          <option value="premium">Premium</option>
        </select>
        {hasFilters && (
          <button className="btn btn-secondary btn-sm" onClick={clearFilters}>
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {/* Results count */}
      {!loading && (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          {filtered.length} product{filtered.length !== 1 ? 's' : ''} found
        </p>
      )}

      {/* Table / Loading / Empty */}
      {loading ? (
        <SkeletonTableRows rows={5} />
      ) : filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: '3rem' }}>
          <Package size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
          {products.length === 0 ? (
            <>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                No products yet. Click 'Add Product' to get started →
              </p>
              <button className="btn btn-primary" onClick={handleCreate}>
                <Plus size={16} /> Add Product
              </button>
            </>
          ) : (
            <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
              No products match your filters.
            </p>
          )}
        </div>
      ) : (
        <ProductTable products={filtered} onEdit={handleEdit} onDelete={setDeleteTarget} />
      )}

      {/* Product Create/Edit Form */}
      <ProductForm
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        editProduct={editingProduct}
      />

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Product">
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
          Are you sure you want to delete <strong style={{ color: 'var(--text-primary)' }}>{deleteTarget?.productName}</strong>?
          This will soft-delete the product (set as inactive).
        </p>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={handleDelete}>Delete Product</button>
        </div>
      </Modal>
    </div>
  );
}
