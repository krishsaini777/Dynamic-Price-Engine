import React from 'react';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';

/**
 * Gap analysis card — displays the comparison between our price and the
 * staleness-weighted median competitor price per Part 10.
 *
 * Expects `analysis` prop shaped like GET /competitors/:productId/analysis response.data:
 *   ourPrice, medianCompetitorPrice, gapPercent, interpretation, freshCount, staleCount,
 *   outlierCount, signal, multiplier
 */
export default function GapAnalysisCard({ analysis }) {
  if (!analysis) {
    return (
      <div className="card" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <p>Select a product and add competitor prices to see gap analysis.</p>
      </div>
    );
  }

  const { ourPrice, medianCompetitorPrice, gapPercent, interpretation, freshCount, staleCount, outlierCount, signal, multiplier } = analysis;

  const isDown = gapPercent < 0;
  const accentColor = isDown ? 'var(--accent-red)' : gapPercent > 0 ? 'var(--accent-green)' : 'var(--text-muted)';

  const signalLabel = {
    COMPETITORS_EXPENSIVE: 'Our price is below market — room to increase',
    SLIGHTLY_EXPENSIVE: 'Slightly below market',
    NEAR_PARITY: 'Near parity with competitors',
    SLIGHTLY_CHEAPER: 'Slightly above market',
    COMPETITORS_CHEAPER: 'We are overpriced — downward pressure',
  };

  return (
    <div className="card animate-fade-in" style={{ borderLeft: `3px solid ${accentColor}` }}>
      <p style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '1rem' }}>
        Gap Analysis
      </p>

      {/* Price comparison */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Our Price</p>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'monospace' }}>₹{ourPrice?.toLocaleString('en-IN')}</p>
        </div>
        <ArrowRight size={20} color="var(--text-muted)" />
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Median Competitor</p>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'monospace' }}>₹{medianCompetitorPrice?.toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Gap percent */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        {isDown ? <TrendingDown size={18} color={accentColor} /> : <TrendingUp size={18} color={accentColor} />}
        <span style={{ fontSize: '1.1rem', fontWeight: 700, color: accentColor }}>
          {gapPercent > 0 ? '+' : ''}{gapPercent?.toFixed(1)}%
        </span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {signalLabel[interpretation] || interpretation}
        </span>
      </div>

      {/* Data quality */}
      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
        <span><strong style={{ color: 'var(--accent-green)' }}>{freshCount}</strong> fresh</span>
        <span><strong style={{ color: 'var(--accent-orange)' }}>{staleCount}</strong> stale</span>
        <span><strong style={{ color: 'var(--accent-yellow)' }}>{outlierCount}</strong> outliers</span>
        <span style={{ marginLeft: 'auto' }}>Signal: <strong style={{ color: accentColor }}>×{multiplier?.toFixed(3)}</strong></span>
      </div>
    </div>
  );
}
