import React from 'react';
import ConfidenceBadge from '../common/ConfidenceBadge';
import { Info } from 'lucide-react';

/**
 * ConfidencePanel — Renders confidence score with its breakdown and
 * "what would change this" hints from the explanation object.
 */
export default function ConfidencePanel({ decision, explanation }) {
  if (!decision) return null;

  const score = decision.confidenceScore ?? 0;
  const pct = Math.round(score * 100);

  return (
    <div className="card animate-fade-in" style={{ padding: '1.25rem' }}>
      <p style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
        Confidence Analysis
      </p>

      {/* Score bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ flex: 1, height: 10, borderRadius: 5, background: 'var(--bg-input)', overflow: 'hidden' }}>
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              borderRadius: 5,
              background: score >= 0.7 ? 'var(--accent-green)' : score >= 0.4 ? 'var(--accent-yellow)' : 'var(--accent-red)',
              transition: 'width 0.6s ease',
            }}
          />
        </div>
        <ConfidenceBadge score={score} level={decision.confidenceLevel} />
      </div>

      {/* Key indicators */}
      <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Final Multiplier: </span>
          <strong>×{decision.finalMultiplier?.toFixed(3)}</strong>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Auto-Apply: </span>
          <strong style={{ color: decision.shouldApply ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            {decision.shouldApply ? 'Yes' : 'No'}
          </strong>
        </div>
      </div>

      {/* Primary driver */}
      <div style={{ padding: '0.75rem', background: 'var(--bg-input)', borderRadius: 8, marginBottom: '0.75rem' }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Primary Driver</p>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>{decision.primaryDriver}</p>
      </div>

      {/* What would change this */}
      {explanation?.whatWouldChangeThis?.length > 0 && (
        <div>
          <p style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Info size={12} /> What Would Change This
          </p>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {explanation.whatWouldChangeThis.map((hint, i) => (
              <li
                key={i}
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  paddingLeft: '1rem',
                  borderLeft: '2px solid var(--border-color)',
                  lineHeight: 1.5,
                }}
              >
                {hint}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
