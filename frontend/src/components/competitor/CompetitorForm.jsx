import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';

const SOURCES = ['manual', 'scraper', 'api', 'marketplace'];

const emptyForm = {
  competitorName: '',
  competitorPrice: '',
  source: 'manual',
  competitorUrl: '',
};

export default function CompetitorForm({ isOpen, onClose, onSubmit, editItem, productId }) {
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!editItem;

  useEffect(() => {
    if (editItem) {
      setForm({
        competitorName: editItem.competitorName || '',
        competitorPrice: editItem.competitorPrice ?? '',
        source: editItem.source || 'manual',
        competitorUrl: editItem.competitorUrl || '',
      });
    } else {
      setForm(emptyForm);
    }
  }, [editItem, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        competitorPrice: Number(form.competitorPrice),
        productId,
        recordedAt: new Date().toISOString(),
      };
      await onSubmit(payload);
      onClose();
    } catch (err) {
      // handled by parent
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Competitor Price' : 'Add Competitor Price'} maxWidth={460}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <label className="label">Competitor Name *</label>
            <input className="input" name="competitorName" value={form.competitorName} onChange={handleChange} required placeholder="e.g. Amazon, Flipkart" />
          </div>
          <div>
            <label className="label">Price (₹) *</label>
            <input className="input" name="competitorPrice" type="number" min="0" step="0.01" value={form.competitorPrice} onChange={handleChange} required />
          </div>
          <div>
            <label className="label">Source</label>
            <select className="select" name="source" value={form.source} onChange={handleChange}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">URL</label>
            <input className="input" name="competitorUrl" value={form.competitorUrl} onChange={handleChange} placeholder="Optional product link" />
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving...' : isEdit ? 'Update' : 'Add Competitor'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
