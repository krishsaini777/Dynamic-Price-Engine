import React from 'react';
import { Tag } from 'lucide-react';

/**
 * EventOverlayCard — Shows the active promotional event discount overlay.
 * Returns null if no event is applied.
 *
 * Props:
 *   eventOverlay — the eventOverlay object from POST /pricing/calculate
 */
export default function EventOverlayCard({ eventOverlay }) {
  if (!eventOverlay?.eventApplied) return null;

  const {
    eventName, discountType, discountValue,
    priceBeforeDiscount, finalCustomerPrice, constraintApplied,
  } = eventOverlay;

  const discountLabel =
    discountType === 'percentage'
      ? `${discountValue}% off applied`
      : discountType === 'flat_amount'
      ? `₹${discountValue} flat discount applied`
      : `Fixed price set to ₹${discountValue}`;

  return (
    <div className="card animate-fade-in" style={{
      borderLeft: '3px solid var(--accent-yellow)',
      padding: '1.25rem',
      background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.04), transparent)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: 'rgba(251, 191, 36, 0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Tag size={14} color="var(--accent-yellow)" />
        </div>
        <p style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--accent-yellow)' }}>
          🏷️ Active Promotion
        </p>
      </div>

      {/* Event Name */}
      <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
        {eventName}
      </p>

      {/* Discount Description */}
      <p style={{ fontSize: '0.85rem', color: 'var(--accent-yellow)', fontWeight: 500, marginBottom: '0.75rem' }}>
        {discountLabel}
      </p>

      {/* Price Transition */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <span style={{
          fontSize: '1.15rem', fontFamily: 'monospace', fontWeight: 600,
          color: 'var(--text-muted)', textDecoration: 'line-through',
        }}>
          ₹{priceBeforeDiscount?.toLocaleString('en-IN')}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>→</span>
        <span style={{
          fontSize: '1.4rem', fontFamily: 'monospace', fontWeight: 800,
          color: 'var(--accent-yellow)',
        }}>
          ₹{finalCustomerPrice?.toLocaleString('en-IN')}
        </span>
      </div>

      {/* Footer */}
      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.25rem' }}>
        Discount applied after market-optimal price calculation.
      </p>

      {/* Constraint warning */}
      {constraintApplied && constraintApplied !== 'NONE' && (
        <p style={{ fontSize: '0.75rem', color: 'var(--accent-orange)', marginTop: '0.35rem' }}>
          ⚠ Profit floor applied — discount was capped to protect margin.
        </p>
      )}
    </div>
  );
}
