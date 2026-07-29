import React from 'react';
import { Pencil, Trash2, Clock, AlertTriangle } from 'lucide-react';

/**
 * Calculates staleness from lastUpdated date.
 * Returns { label, color, isFresh }.
 */
function staleness(lastUpdated) {
  if (!lastUpdated) return { label: 'Unknown', color: 'var(--text-muted)', isFresh: false };
  const hoursAgo = (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60);
  if (hoursAgo <= 12) return { label: `${Math.round(hoursAgo)}h ago`, color: 'var(--accent-green)', isFresh: true };
  if (hoursAgo <= 36) return { label: `${Math.round(hoursAgo)}h ago`, color: 'var(--accent-orange)', isFresh: true };
  if (hoursAgo <= 72) return { label: `${Math.round(hoursAgo)}h ago`, color: 'var(--accent-red)', isFresh: true };
  return { label: 'Stale', color: 'var(--text-muted)', isFresh: false };
}

export default function CompetitorTable({ competitors, onEdit, onDelete }) {
  if (!competitors || competitors.length === 0) {
    return (
      <div className="empty-state">
        <p>No competitor prices recorded for this product.</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            <th>Competitor</th>
            <th>Price (₹)</th>
            <th>Source</th>
            <th>Freshness</th>
            <th>Outlier</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {competitors.map((c) => {
            const s = staleness(c.lastUpdated || c.updatedAt);
            return (
              <tr key={c._id}>
                <td style={{ fontWeight: 500 }}>{c.competitorName}</td>
                <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                  ₹{c.competitorPrice?.toLocaleString('en-IN')}
                </td>
                <td>
                  <span className="badge badge-gray">{c.source || 'manual'}</span>
                </td>
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}>
                    <Clock size={13} color={s.color} />
                    <span style={{ color: s.color }}>{s.label}</span>
                  </span>
                </td>
                <td>
                  {c.isOutlier ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--accent-yellow)', fontSize: '0.8rem' }}>
                      <AlertTriangle size={13} /> Outlier
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>—</span>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => onEdit(c)}>
                      <Pencil size={14} />
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => onDelete(c)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
