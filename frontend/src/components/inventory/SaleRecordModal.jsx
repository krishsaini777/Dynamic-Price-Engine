import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';

export default function SaleRecordModal({ isOpen, onClose, onSubmit, item, saleSuccess }) {
  const [form, setForm] = useState({
    quantity: '1',
    priceAtSale: '',
    channel: 'web',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && item) {
      setForm({
        quantity: '1',
        priceAtSale: item.productId?.currentPrice ?? '',
        channel: 'web',
      });
      setError(null);
    }
  }, [isOpen, item]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!item) return;

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        productId: item.productId._id || item.productId,
        quantity: Number(form.quantity),
        priceAtSale: Number(form.priceAtSale),
        channel: form.channel,
        soldAt: new Date().toISOString(),
      });
      // Parent handles auto-close after success
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!item) return null;
  const productName = item.productId?.productName || 'Product';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Sale" maxWidth={450}>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Record a sale for{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{productName}</strong>. This feeds the
            demand velocity engine.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label className="label">Quantity Sold *</label>
              <input
                type="number"
                className="input"
                name="quantity"
                min="1"
                step="1"
                required
                value={form.quantity}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="label">Sale Price (₹) *</label>
              <input
                type="number"
                className="input"
                name="priceAtSale"
                min="0"
                step="0.01"
                required
                value={form.priceAtSale}
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <label className="label">Sales Channel</label>
            <select className="select" name="channel" value={form.channel} onChange={handleChange}>
              <option value="web">Web (Direct)</option>
              <option value="app">Mobile App</option>
              <option value="marketplace">Marketplace</option>
              <option value="retail">Retail Store</option>
            </select>
          </div>
        </div>

        {saleSuccess && (
          <div
            style={{
              padding: '0.75rem',
              background: 'rgba(34, 197, 94, 0.1)',
              color: 'var(--accent-green)',
              fontSize: '0.85rem',
              fontWeight: 600,
              borderRadius: 8,
              marginBottom: '1rem',
              textAlign: 'center',
            }}
          >
            Sale recorded ✓
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '0.75rem',
              background: 'rgba(239, 68, 68, 0.1)',
              color: 'var(--accent-red)',
              fontSize: '0.8rem',
              borderRadius: 8,
              marginBottom: '1rem',
            }}
          >
            {error}
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-success" disabled={submitting}>
            {submitting ? 'Recording...' : 'Record Sale'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
