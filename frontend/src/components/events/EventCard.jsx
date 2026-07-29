import React from 'react';
import { CalendarRange, Tag } from 'lucide-react';
import EventStatusBadge from './EventStatusBadge';

/**
 * EventCard — Compact card for displaying an event summary.
 *
 * Props:
 *   event — a single event object
 */
export default function EventCard({ event }) {
  if (!event) return null;

  const startStr = new Date(event.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  const endStr = new Date(event.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const discountLabel =
    event.discountType === 'percentage'
      ? `${event.discountValue}% off`
      : event.discountType === 'flat_amount'
      ? `₹${event.discountValue} off`
      : `→ ₹${event.discountValue}`;

  return (
    <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{event.eventName}</p>
        <EventStatusBadge status={event.status} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <CalendarRange size={13} /> {startStr} — {endStr}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <Tag size={13} /> {discountLabel}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.7rem' }}>
        <span className="badge badge-gray">{event.eventType?.replace(/_/g, ' ')}</span>
        <span className="badge badge-gray">P{event.priority}</span>
        {event.targetType === 'specific_categories' && event.targetCategories?.length > 0 && (
          <span className="badge badge-blue">{event.targetCategories.join(', ')}</span>
        )}
      </div>
    </div>
  );
}
