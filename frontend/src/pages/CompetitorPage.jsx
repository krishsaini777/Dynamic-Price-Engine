import React, { useState, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { getProducts } from '../api/productApi';
import { getCompetitors, createCompetitor, updateCompetitor, deleteCompetitor, getGapAnalysis } from '../api/competitorApi';
import CompetitorTable from '../components/competitor/CompetitorTable';
import CompetitorForm from '../components/competitor/CompetitorForm';
import GapAnalysisCard from '../components/competitor/GapAnalysisCard';
import Modal from '../components/common/Modal';
import ErrorAlert from '../components/common/ErrorAlert';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function CompetitorPage() {
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [competitors, setCompetitors] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Load products for the selector
  useEffect(() => {
    (async () => {
      try {
        const res = await getProducts();
        setProducts(res.data || []);
        if (res.data?.length > 0) setSelectedProductId(res.data[0]._id);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, []);

  // Fetch competitors + gap analysis whenever product changes
  const fetchData = useCallback(async () => {
    if (!selectedProductId) return;
    setLoading(true);
    try {
      const [compRes, gapRes] = await Promise.allSettled([
        getCompetitors(selectedProductId),
        getGapAnalysis(selectedProductId),
      ]);
      setCompetitors(compRes.status === 'fulfilled' ? (compRes.value.data || []) : []);
      setAnalysis(gapRes.status === 'fulfilled' ? gapRes.value.data : null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedProductId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = () => { setEditItem(null); setFormOpen(true); };
  const handleEdit = (item) => { setEditItem(item); setFormOpen(true); };

  const handleFormSubmit = async (data) => {
    try {
      setError(null);
      if (editItem) {
        await updateCompetitor(editItem._id, data);
      } else {
        await createCompetitor(data);
      }
      await fetchData();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCompetitor(deleteTarget._id);
      setDeleteTarget(null);
      await fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Competitors</h1>
          <p className="page-subtitle">Track competitor pricing and gap analysis</p>
        </div>
        <button className="btn btn-primary" onClick={handleCreate} disabled={!selectedProductId}>
          <Plus size={16} /> Add Competitor
        </button>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {/* Product selector */}
      <div style={{ marginBottom: '1.25rem' }}>
        <label className="label">Product</label>
        <select
          className="select"
          value={selectedProductId}
          onChange={(e) => setSelectedProductId(e.target.value)}
          style={{ maxWidth: 400 }}
        >
          {products.map((p) => (
            <option key={p._id} value={p._id}>
              {p.productName} ({p.sku}) — ₹{p.currentPrice?.toLocaleString('en-IN')}
            </option>
          ))}
        </select>
      </div>

      {/* Gap Analysis */}
      <div style={{ marginBottom: '1.25rem' }}>
        <GapAnalysisCard analysis={analysis} />
      </div>

      {/* Competitor Table */}
      {loading ? (
        <LoadingSpinner text="Loading competitor data..." />
      ) : (
        <CompetitorTable competitors={competitors} onEdit={handleEdit} onDelete={setDeleteTarget} />
      )}

      {/* Add/Edit Form */}
      <CompetitorForm
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        editItem={editItem}
        productId={selectedProductId}
      />

      {/* Delete confirmation */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Remove Competitor">
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
          Remove <strong style={{ color: 'var(--text-primary)' }}>{deleteTarget?.competitorName}</strong> pricing data?
        </p>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={handleDelete}>Remove</button>
        </div>
      </Modal>
    </div>
  );
}
