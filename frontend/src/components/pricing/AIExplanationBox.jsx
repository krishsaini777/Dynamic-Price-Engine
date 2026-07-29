import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';

/**
 * AIExplanationBox — Displays the Gemini AI explanation for a pricing decision.
 *
 * Props:
 *   aiText   — The AI-generated explanation string
 *   headline — Optional headline from explanation.headline
 *   failed   — Boolean, true if AI was unavailable
 *   loading  — Boolean, true while the pricing engine is still running
 */
export default function AIExplanationBox({ aiText, headline, failed, failureReason, loading }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (aiText && !loading) {
      const t = setTimeout(() => setVisible(true), 50);
      return () => clearTimeout(t);
    }
    setVisible(false);
  }, [aiText, loading]);

  // ── Loading shimmer ──
  if (loading) {
    return (
      <div className="card" style={{ padding: '1.25rem', borderLeft: '3px solid var(--accent-indigo)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
          <Sparkles size={16} color="var(--accent-indigo)" />
          <span style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--accent-indigo)' }}>
            AI Explanation
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ width: '100%', height: 12, borderRadius: 4, background: 'var(--bg-hover)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ width: '85%', height: 12, borderRadius: 4, background: 'var(--bg-hover)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: '0.15s' }} />
          <div style={{ width: '60%', height: 12, borderRadius: 4, background: 'var(--bg-hover)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: '0.3s' }} />
        </div>
      </div>
    );
  }

  // ── Failed graceful fallback ──
  if (failed) {
    return (
      <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '3px solid var(--border-color)', transition: 'opacity 400ms ease', opacity: visible ? 1 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Sparkles size={16} color="var(--text-muted)" />
          <p style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            Rule-Based Explanation (AI Unavailable)
          </p>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          {aiText || "AI explanation unavailable for this recommendation."}
        </p>
        {failureReason && (
          <div style={{ padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '4px' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--accent-red)', margin: 0 }}>
              <strong>AI Error:</strong> {failureReason}
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── No text yet ──
  if (!aiText) return null;

  // ── Loaded with text — fade in ──
  return (
    <div
      className="card"
      style={{
        padding: '1.25rem',
        borderLeft: '3px solid var(--accent-indigo)',
        transition: 'opacity 400ms ease',
        opacity: visible ? 1 : 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <Sparkles size={16} color="var(--accent-indigo)" />
        <span style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--accent-indigo)' }}>
          AI Explanation
        </span>
      </div>
      {headline && (
        <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
          {headline}
        </p>
      )}
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
        {aiText}
      </p>
    </div>
  );
}
