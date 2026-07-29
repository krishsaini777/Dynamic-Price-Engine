import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';

export default function StockUpdateModal({ isOpen, onClose, onSubmit, item }) {
  const [quantity, setQuantity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && item) {
      setQuantity(item.availableQuantity ?? '');
      setError(null);
    }
  }, [isOpen, item]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!item) return;

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(item.productId._id || item.productId, {
        availableQuantity: Number(quantity),
      });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!item) return null;
  const productName = item.productId?.productName || 'Product';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Update Stock Level" maxWidth={400}>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Updating inventory for{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{productName}</strong>
          </p>

          <label className="label">Available Quantity</label>
          <input
            type="number"
            className="input"
            min="0"
            step="1"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Current quantity: {item.availableQuantity}
          </p>
        </div>

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
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Updating...' : 'Update Stock'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
