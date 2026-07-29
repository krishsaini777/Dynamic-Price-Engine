import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';

const EVENT_TYPES = [
  'weekend_sale', 'festival_sale', 'anniversary_sale', 'flash_sale',
  'clearance_sale', 'product_specific', 'category_sale', 'custom',
];
const DISCOUNT_TYPES = ['percentage', 'flat_amount', 'fixed_price'];
const TARGET_TYPES = ['all_products', 'specific_products', 'specific_categories'];
const CATEGORIES = ['Electronics', 'Clothing', 'Home', 'Sports', 'Books', 'Food', 'Beauty', 'Toys', 'Automotive', 'Other'];

const emptyForm = {
  eventName: '',
  eventType: 'category_sale',
  description: '',
  startDate: '',
  endDate: '',
  priority: '5',
  discountType: 'percentage',
  discountValue: '',
  targetType: 'all_products',
  targetCategories: [],
  respectProfitFloor: true,
};

export default function EventForm({ isOpen, onClose, onSubmit, editEvent }) {
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!editEvent;

  useEffect(() => {
    if (editEvent) {
      setForm({
        eventName: editEvent.eventName || '',
        eventType: editEvent.eventType || 'category_sale',
        description: editEvent.description || '',
        startDate: editEvent.startDate ? new Date(editEvent.startDate).toISOString().slice(0, 16) : '',
        endDate: editEvent.endDate ? new Date(editEvent.endDate).toISOString().slice(0, 16) : '',
        priority: editEvent.priority ?? '5',
        discountType: editEvent.discountType || 'percentage',
        discountValue: editEvent.discountValue ?? '',
        targetType: editEvent.targetType || 'all_products',
        targetCategories: editEvent.targetCategories || [],
        respectProfitFloor: editEvent.respectProfitFloor ?? true,
      });
    } else {
      setForm(emptyForm);
    }
  }, [editEvent, isOpen]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleCategoryToggle = (cat) => {
    setForm((prev) => ({
      ...prev,
      targetCategories: prev.targetCategories.includes(cat)
        ? prev.targetCategories.filter((c) => c !== cat)
        : [...prev.targetCategories, cat],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        priority: Number(form.priority),
        discountValue: Number(form.discountValue),
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
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
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Event' : 'Create Event'} maxWidth={560}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="label">Event Name *</label>
            <input className="input" name="eventName" value={form.eventName} onChange={handleChange} required minLength={3} />
          </div>

          <div>
            <label className="label">Event Type *</label>
            <select className="select" name="eventType" value={form.eventType} onChange={handleChange}>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Priority (1=highest)</label>
            <input className="input" name="priority" type="number" min="1" max="10" value={form.priority} onChange={handleChange} />
          </div>

          <div>
            <label className="label">Start Date *</label>
            <input className="input" name="startDate" type="datetime-local" value={form.startDate} onChange={handleChange} required />
          </div>
          <div>
            <label className="label">End Date *</label>
            <input className="input" name="endDate" type="datetime-local" value={form.endDate} onChange={handleChange} required />
          </div>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <label className="label">Description</label>
          <input className="input" name="description" value={form.description} onChange={handleChange} placeholder="Optional event description" />
        </div>

        {/* Discount Config */}
        <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '1.25rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Discount
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label className="label">Discount Type *</label>
            <select className="select" name="discountType" value={form.discountType} onChange={handleChange}>
              {DISCOUNT_TYPES.map((d) => (
                <option key={d} value={d}>
                  {d === 'percentage' ? 'Percentage (%)' : d === 'flat_amount' ? 'Flat Amount (₹)' : 'Fixed Price (₹)'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Discount Value *</label>
            <input className="input" name="discountValue" type="number" min="0" step="0.01" value={form.discountValue} onChange={handleChange} required />
          </div>
        </div>

        {/* Targeting */}
        <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '1.25rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Targeting
        </p>
        <div>
          <label className="label">Target Type</label>
          <select className="select" name="targetType" value={form.targetType} onChange={handleChange}>
            {TARGET_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        {form.targetType === 'specific_categories' && (
          <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategoryToggle(cat)}
                className={`badge ${form.targetCategories.includes(cat) ? 'badge-blue' : 'badge-gray'}`}
                style={{ cursor: 'pointer', fontSize: '0.75rem', padding: '0.3rem 0.75rem' }}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Profit floor toggle */}
        <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" name="respectProfitFloor" checked={form.respectProfitFloor} onChange={handleChange} id="profitFloor" />
          <label htmlFor="profitFloor" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            Respect profitability floor (never sell below cost + margin)
          </label>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving...' : isEdit ? 'Update Event' : 'Create Event'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
