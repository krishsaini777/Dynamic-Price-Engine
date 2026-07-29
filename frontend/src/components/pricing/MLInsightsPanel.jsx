import React, { useState, useEffect } from 'react';
import { Cpu, ShieldCheck, Activity, BrainCircuit } from 'lucide-react';
import GuardrailList from './GuardrailList';
import { getModelStatus } from '../../api/pricingApi';

export default function MLInsightsPanel({ result }) {
  const [modelStatus, setModelStatus] = useState(null);

  useEffect(() => {
    // Fetch model status independently of the recommendation result
    getModelStatus().then(res => {
      if (res.success) setModelStatus(res.data);
    }).catch(err => console.warn('Failed to fetch ML model status:', err));
  }, []);

  if (!result || !result.outcome) return null;

  const { outcome } = result;
  const isHybrid = outcome.usedMLModel;
  const rawML = outcome.mlRawPrice;
  const finalPrice = outcome.recommendedPrice;
  const guardrails = outcome.guardrailsApplied || [];

  return (
    <div className="card" style={{ marginTop: '1.5rem', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1.25rem',
        borderBottom: '1px solid var(--border-color)',
        background: 'rgba(79, 70, 229, 0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <BrainCircuit size={20} color="var(--accent-indigo)" />
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Hybrid Engine Insights</h3>
        </div>
        
        {modelStatus && (
          <span className={`badge ${modelStatus.loaded ? 'badge-indigo' : 'badge-orange'}`} style={{ fontSize: '0.7rem' }}>
            {modelStatus.loaded ? `XGBoost v${modelStatus.version}` : 'Deterministic Fallback'}
          </span>
        )}
      </div>

      <div style={{ padding: '1.25rem' }}>
        {/* ML vs Final Comparison */}
        {isHybrid && rawML && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
            {/* AI Proposal */}
            <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                <Cpu size={14} />
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>AI Proposal</span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'monospace' }}>
                ₹{rawML.toLocaleString('en-IN')}
              </div>
            </div>

            {/* Arrow */}
            <div style={{ color: 'var(--text-muted)' }}>→</div>

            {/* Guardrail Approval */}
            <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: 8, textAlign: 'center', border: '1px solid var(--accent-indigo)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--accent-indigo)' }}>
                <ShieldCheck size={14} />
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Rule Approval</span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--accent-indigo)' }}>
                ₹{finalPrice.toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        )}

        {/* Non-hybrid fallback state */}
        {!isHybrid && (
          <div style={{ padding: '1rem', background: 'var(--bg-input)', borderRadius: 8, marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <Activity size={18} color="var(--accent-orange)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem' }}>Deterministic Mode Active</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                The ML model was unavailable or bypassed. This price was generated using the fallback deterministic multiplier system.
              </p>
            </div>
          </div>
        )}

        {/* Guardrails List */}
        <div>
          <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Guardrails Triggered ({guardrails.length})
          </h4>
          <GuardrailList guardrails={guardrails} />
        </div>
      </div>
    </div>
  );
}
