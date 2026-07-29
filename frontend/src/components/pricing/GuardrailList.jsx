import React from 'react';
import { Shield, AlertTriangle, CheckCircle, Info } from 'lucide-react';

/**
 * GuardrailList Component
 * Renders the list of business rules that were triggered for a specific pricing decision.
 *
 * @param {Array} guardrails - Array of guardrail log objects { rule, detail, ... }
 */
export default function GuardrailList({ guardrails }) {
  if (!guardrails || guardrails.length === 0) {
    return (
      <div style={{ padding: '1rem', background: 'var(--bg-input)', borderRadius: 8, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        No guardrails were triggered. The ML model's price was accepted as-is.
      </div>
    );
  }

  const getIcon = (rule) => {
    if (rule.includes('PROFIT') || rule.includes('CEILING')) return <AlertTriangle size={16} color="var(--accent-red)" />;
    if (rule.includes('STABILITY') || rule.includes('COMPETITOR')) return <Shield size={16} color="var(--accent-orange)" />;
    if (rule.includes('CHARM')) return <CheckCircle size={16} color="var(--accent-green)" />;
    return <Info size={16} color="var(--text-muted)" />;
  };

  const getBadgeClass = (rule) => {
    if (rule.includes('PROFIT') || rule.includes('CEILING')) return 'badge-red';
    if (rule.includes('STABILITY') || rule.includes('COMPETITOR')) return 'badge-orange';
    if (rule.includes('CHARM')) return 'badge-green';
    return 'badge-gray';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {guardrails.map((g, idx) => (
        <div key={idx} style={{
          display: 'flex',
          gap: '0.75rem',
          padding: '0.75rem',
          background: 'var(--bg-input)',
          borderRadius: 8,
          border: '1px solid var(--border-color)',
          alignItems: 'flex-start'
        }}>
          <div style={{ marginTop: 2 }}>{getIcon(g.rule)}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span className={`badge ${getBadgeClass(g.rule)}`} style={{ fontSize: '0.7rem' }}>
                {g.rule.replace('_', ' ')}
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
              {g.detail}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
