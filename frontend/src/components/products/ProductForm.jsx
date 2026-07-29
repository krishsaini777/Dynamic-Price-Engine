import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';

const CATEGORIES = [
  'Electronics', 'Clothing', 'Home', 'Sports', 'Books',
  'Food', 'Beauty', 'Toys', 'Automotive', 'Other',
];
const TIERS = ['budget', 'mid', 'premium'];
const SEASONS = ['none', 'monsoon', 'summer', 'winter', 'festive'];

const emptyForm = {
  productName: '',
  sku: '',
  category: 'Electronics',
  description: '',
  costPrice: '',
  basePrice: '',
  currentPrice: '',
  targetMargin: '0.15',
  tier: 'mid',
  pricingStrategy: { mode: 'auto', maxIncreasePct: '0.15', maxDecreasePct: '0.15' },
  seasonalConfig: { season: 'none', startDate: '', peakDate: '', endDate: '', maxBoost: '0.12' },
};

export default function ProductForm({ isOpen, onClose, onSubmit, editProduct }) {
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!editProduct;

  useEffect(() => {
    if (editProduct) {
      setForm({
        productName: editProduct.productName || '',
        sku: editProduct.sku || '',
        category: editProduct.category || 'Electronics',
        description: editProduct.description || '',
        costPrice: editProduct.costPrice ?? '',
        basePrice: editProduct.basePrice ?? '',
        currentPrice: editProduct.currentPrice ?? '',
        targetMargin: editProduct.targetMargin ?? '0.15',
        tier: editProduct.tier || 'mid',
        pricingStrategy: {
          mode: editProduct.pricingStrategy?.mode || 'auto',
          maxIncreasePct: editProduct.pricingStrategy?.maxIncreasePct ?? '0.15',
          maxDecreasePct: editProduct.pricingStrategy?.maxDecreasePct ?? '0.15',
        },
        seasonalConfig: {
          season: editProduct.seasonalConfig?.season || 'none',
          startDate: editProduct.seasonalConfig?.startDate || '',
          peakDate: editProduct.seasonalConfig?.peakDate || '',
          endDate: editProduct.seasonalConfig?.endDate || '',
          maxBoost: editProduct.seasonalConfig?.maxBoost ?? '0.12',
        },
      });
    } else {
      setForm(emptyForm);
    }
  }, [editProduct, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleNestedChange = (group, key, value) => {
    setForm((prev) => ({
      ...prev,
      [group]: { ...prev[group], [key]: value },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        costPrice: Number(form.costPrice),
        basePrice: Number(form.basePrice),
        currentPrice: Number(form.currentPrice),
        targetMargin: Number(form.targetMargin),
        pricingStrategy: {
          mode: form.pricingStrategy.mode,
          maxIncreasePct: Number(form.pricingStrategy.maxIncreasePct),
          maxDecreasePct: Number(form.pricingStrategy.maxDecreasePct),
        },
        seasonalConfig: {
          ...form.seasonalConfig,
          maxBoost: Number(form.seasonalConfig.maxBoost),
        },
      };
      await onSubmit(payload);
      onClose();
    } catch (err) {
      // Error handled by parent
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Product' : 'Add Product'} maxWidth={600}>
      <form onSubmit={handleSubmit}>
        {/* Basic Info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label className="label">Product Name *</label>
            <input className="input" name="productName" value={form.productName} onChange={handleChange} required minLength={2} />
          </div>
          <div>
            <label className="label">SKU *</label>
            <input className="input" name="sku" value={form.sku} onChange={handleChange} required style={{ textTransform: 'uppercase' }} disabled={isEdit} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          <div>
            <label className="label">Category *</label>
            <select className="select" name="category" value={form.category} onChange={handleChange}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Tier</label>
            <select className="select" name="tier" value={form.tier} onChange={handleChange}>
              {TIERS.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <label className="label">Description</label>
          <input className="input" name="description" value={form.description} onChange={handleChange} placeholder="Optional description" />
        </div>

        {/* Pricing */}
        <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '1.25rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Pricing
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <div>
            <label className="label">Cost Price (₹) *</label>
            <input className="input" name="costPrice" type="number" min="0" step="0.01" value={form.costPrice} onChange={handleChange} required />
          </div>
          <div>
            <label className="label">Base Price (₹) *</label>
            <input className="input" name="basePrice" type="number" min="0" step="0.01" value={form.basePrice} onChange={handleChange} required />
          </div>
          <div>
            <label className="label">Current Price (₹) *</label>
            <input className="input" name="currentPrice" type="number" min="0" step="0.01" value={form.currentPrice} onChange={handleChange} required />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          <div>
            <label className="label">Target Margin</label>
            <input className="input" name="targetMargin" type="number" min="0" max="1" step="0.01" value={form.targetMargin} onChange={handleChange} />
          </div>
          <div>
            <label className="label">Max Increase %</label>
            <input
              className="input" type="number" min="0" max="1" step="0.01"
              value={form.pricingStrategy.maxIncreasePct}
              onChange={(e) => handleNestedChange('pricingStrategy', 'maxIncreasePct', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Max Decrease %</label>
            <input
              className="input" type="number" min="0" max="1" step="0.01"
              value={form.pricingStrategy.maxDecreasePct}
              onChange={(e) => handleNestedChange('pricingStrategy', 'maxDecreasePct', e.target.value)}
            />
          </div>
        </div>

        {/* Seasonal Config */}
        <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '1.25rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Seasonal Config
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label className="label">Season</label>
            <select
              className="select"
              value={form.seasonalConfig.season}
              onChange={(e) => handleNestedChange('seasonalConfig', 'season', e.target.value)}
            >
              {SEASONS.map((s) => <option key={s} value={s}>{s === 'none' ? 'None' : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Max Boost</label>
            <input
              className="input" type="number" min="0" max="0.5" step="0.01"
              value={form.seasonalConfig.maxBoost}
              onChange={(e) => handleNestedChange('seasonalConfig', 'maxBoost', e.target.value)}
            />
          </div>
        </div>
        {form.seasonalConfig.season !== 'none' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
            <div>
              <label className="label">Start Date</label>
              <input
                className="input"
                type="date"
                value={form.seasonalConfig.startDate
                  ? (form.seasonalConfig.startDate.includes('-') && form.seasonalConfig.startDate.length === 5
                      ? `${new Date().getFullYear()}-${form.seasonalConfig.startDate}`
                      : form.seasonalConfig.startDate)
                  : ''}
                onChange={(e) => {
                  // Convert YYYY-MM-DD to MM-DD for storage
                  const val = e.target.value;
                  const mmdd = val ? val.slice(5) : '';
                  handleNestedChange('seasonalConfig', 'startDate', mmdd);
                }}
              />
            </div>
            <div>
              <label className="label">Peak Date</label>
              <input
                className="input"
                type="date"
                value={form.seasonalConfig.peakDate
                  ? (form.seasonalConfig.peakDate.includes('-') && form.seasonalConfig.peakDate.length === 5
                      ? `${new Date().getFullYear()}-${form.seasonalConfig.peakDate}`
                      : form.seasonalConfig.peakDate)
                  : ''}
                onChange={(e) => {
                  const val = e.target.value;
                  const mmdd = val ? val.slice(5) : '';
                  handleNestedChange('seasonalConfig', 'peakDate', mmdd);
                }}
              />
            </div>
            <div>
              <label className="label">End Date</label>
              <input
                className="input"
                type="date"
                value={form.seasonalConfig.endDate
                  ? (form.seasonalConfig.endDate.includes('-') && form.seasonalConfig.endDate.length === 5
                      ? `${new Date().getFullYear()}-${form.seasonalConfig.endDate}`
                      : form.seasonalConfig.endDate)
                  : ''}
                onChange={(e) => {
                  const val = e.target.value;
                  const mmdd = val ? val.slice(5) : '';
                  handleNestedChange('seasonalConfig', 'endDate', mmdd);
                }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving...' : isEdit ? 'Update Product' : 'Create Product'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
