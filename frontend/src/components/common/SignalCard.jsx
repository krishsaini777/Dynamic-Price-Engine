import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const directionIcon = {
  up: <TrendingUp size={16} />,
  down: <TrendingDown size={16} />,
  neutral: <Minus size={16} />,
};

const directionColor = {
  up: 'var(--accent-green)',
  down: 'var(--accent-red)',
  neutral: 'var(--text-muted)',
};

/**
 * Generic reusable card for displaying one pricing signal.
 *
 * Props:
 *   label         – signal name (e.g. "Demand Signal")
 *   multiplier    – numeric multiplier (e.g. 1.08)
 *   interpretation– engine label (e.g. "RISING", "LOW", "NEAR_PARITY")
 *   detail        – optional supporting text (e.g. "velocity 1.63×")
 *   color         – accent color for the left bar
 */
export default function SignalCard({ label, multiplier, interpretation, detail, color }) {
  const direction =
    multiplier > 1.005 ? 'up' : multiplier < 0.995 ? 'down' : 'neutral';
  const pctStr = ((multiplier - 1) * 100).toFixed(1);
  const sign = multiplier >= 1 ? '+' : '';

  return (
    <div
      className="card animate-fade-in"
      style={{
        display: 'flex',
        gap: '0.85rem',
        borderLeft: `3px solid ${color || directionColor[direction]}`,
        padding: '1rem 1.25rem',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: `${(color || directionColor[direction])}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: color || directionColor[direction],
        }}
      >
        {directionIcon[direction]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--text-muted)',
          }}
        >
          {label}
        </p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.15rem' }}>
          <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            ×{multiplier?.toFixed(3) ?? '—'}
          </span>
          <span style={{ fontSize: '0.8rem', color: color || directionColor[direction], fontWeight: 600 }}>
            {sign}{pctStr}%
          </span>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
          {interpretation}
          {detail && <span style={{ color: 'var(--text-muted)' }}> · {detail}</span>}
        </p>
      </div>
    </div>
  );
}
