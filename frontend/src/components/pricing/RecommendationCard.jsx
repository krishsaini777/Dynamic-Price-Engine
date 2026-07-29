import React from 'react';
import { ArrowUp, ArrowDown, ShieldCheck, Check, X, Tag } from 'lucide-react';
import ConfidenceBadge from '../common/ConfidenceBadge';
import SignalCard from '../common/SignalCard';
import SignalBreakdown from './SignalBreakdown';
import EventOverlayCard from './EventOverlayCard';
import AIExplanationBox from './AIExplanationBox';
import ConfidencePanel from './ConfidencePanel';

/**
 * RecommendationCard — THE HERO COMPONENT
 *
 * Displays the full pricing engine response:
 *   - Price recommendation (current → recommended with % change)
 *   - SignalBreakdown waterfall chart
 *   - 4 signal multiplier cards (demand, inventory, competitor, seasonal)
 *   - EventOverlayCard (if active event applies a discount)
 *   - AIExplanationBox (Gemini explanation)
 *   - ConfidencePanel
 *   - Action buttons (Apply / Reject / Apply With/Without Discount)
 *
 * Props:
 *   result        — the full `data` object from POST /pricing/calculate
 *   onApply       — function(decisionId, mode?) to apply recommendation
 *   onReject      — function(decisionId) to reject recommendation
 *   loading       — boolean, true while pricing engine is running (for AI shimmer)
 *   actionLoading — boolean, true while apply/reject API call is in flight
 */
export default function RecommendationCard({ result, onApply, onReject, loading, actionLoading }) {
  if (!result) return null;

  const { product, pricing, signals, decision, eventOverlay, explanation, status } = result;
  const isIncrease = pricing.recommendedPrice > pricing.currentPrice;
  const isDecrease = pricing.recommendedPrice < pricing.currentPrice;
  const isApplied = status === 'APPLIED';
  const isRejected = status === 'REJECTED';
  const isPending = status === 'PENDING';
  const isActioned = isApplied || isRejected;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ─── Price Hero Section ─── */}
      <div className="card" style={{ borderLeft: `3px solid ${isIncrease ? 'var(--accent-green)' : isDecrease ? 'var(--accent-red)' : 'var(--accent-blue)'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <p style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
              Recommendation
            </p>
            <p style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
              {product?.name || product?.productName} <span style={{ color: 'var(--text-muted)' }}>({product?.sku})</span>
            </p>
          </div>
          <ConfidenceBadge score={decision.confidenceScore} level={decision.confidenceLevel} />
        </div>

        {/* Price display */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.5rem', marginBottom: '0.75rem' }}>
          <div>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-secondary)', textDecoration: 'line-through', opacity: 0.6 }}>
              ₹{pricing.currentPrice?.toLocaleString('en-IN')}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: isIncrease ? 'var(--accent-green)' : isDecrease ? 'var(--accent-red)' : 'var(--accent-blue)' }}>
            {isIncrease ? <ArrowUp size={20} /> : isDecrease ? <ArrowDown size={20} /> : null}
            <span style={{ fontSize: '1rem', fontWeight: 600 }}>{pricing.adjustmentPercent}%</span>
          </div>
          <div>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Recommended</p>
            <p style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
              ₹{pricing.recommendedPrice?.toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        {/* Constraints */}
        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span>Floor: ₹{pricing.profitFloor?.toLocaleString('en-IN')}</span>
          <span>Ceiling: ₹{pricing.priceCeiling?.toLocaleString('en-IN')}</span>
          {pricing.constraintApplied !== 'NONE' && (
            <span className="badge badge-orange" style={{ marginLeft: 'auto' }}>
              <ShieldCheck size={12} /> {pricing.constraintApplied}
            </span>
          )}
        </div>

        {/* Status and ML badges */}
        <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {status && (
            <span className={`badge ${isApplied ? 'badge-green' : isRejected ? 'badge-red' : 'badge-yellow'}`}>
              {isApplied ? 'Applied ✓' : isRejected ? 'Rejected ✗' : status}
            </span>
          )}
          
          {decision?.usedMLModel ? (
            <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.15)', color: 'var(--accent-purple)', border: '1px solid rgba(168, 85, 247, 0.3)' }} title={`Raw ML Prediction: ₹${decision.mlRawPrice?.toLocaleString('en-IN')}`}>
              ✨ AI Predicted
            </span>
          ) : decision?.usedMLModel === false ? (
            <span className="badge" style={{ background: 'rgba(156, 163, 175, 0.15)', color: 'var(--text-muted)', border: '1px solid rgba(156, 163, 175, 0.3)' }}>
              ⚙️ Fallback Rules
            </span>
          ) : null}
        </div>
      </div>

      {/* ─── Signal Breakdown Waterfall ─── */}
      <SignalBreakdown
        currentPrice={pricing.currentPrice}
        signals={signals}
        recommendation={pricing}
        eventOverlay={eventOverlay}
      />

      {/* ─── Signal Cards Grid ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <SignalCard
          label="Demand Signal"
          multiplier={signals.demand.multiplier}
          interpretation={signals.demand.interpretation}
          detail={`velocity ${signals.demand.velocityRatio?.toFixed(2)}×`}
          color="var(--accent-green)"
        />
        <SignalCard
          label="Inventory Signal"
          multiplier={signals.inventory.multiplier}
          interpretation={signals.inventory.interpretation}
          detail={`${signals.inventory.coverageDays} days coverage`}
          color="var(--accent-orange)"
        />
        <SignalCard
          label="Competitor Signal"
          multiplier={signals.competitor.multiplier}
          interpretation={signals.competitor.interpretation}
          detail={signals.competitor.medianPrice ? `median ₹${signals.competitor.medianPrice.toLocaleString('en-IN')}` : undefined}
          color="var(--accent-blue)"
        />
        <SignalCard
          label="Seasonal Signal"
          multiplier={signals.seasonal.multiplier}
          interpretation={signals.seasonal.phase || 'off'}
          detail={signals.seasonal.season !== 'none' ? `${signals.seasonal.season} · ${(signals.seasonal.intensity * 100).toFixed(0)}%` : undefined}
          color="var(--accent-purple)"
        />
      </div>

      {/* ─── Event Overlay ─── */}
      <EventOverlayCard eventOverlay={eventOverlay} />

      {/* ─── AI Explanation ─── */}
      <AIExplanationBox
        aiText={explanation?.aiText}
        headline={explanation?.headline}
        failed={explanation?.failed}
        failureReason={explanation?.failureReason}
        loading={loading}
      />

      {/* ─── Confidence Panel ─── */}
      <ConfidencePanel decision={decision} explanation={explanation} />

      {/* ─── Action Buttons ─── */}
      {isPending && (
        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-success"
              style={{ flex: 1, minWidth: 140 }}
              onClick={() => onApply?.(result.decisionId || result._id)}
              disabled={actionLoading}
            >
              <Check size={16} /> Apply ₹{pricing.recommendedPrice?.toLocaleString('en-IN')}
            </button>

            {eventOverlay?.eventApplied && (
              <>
                <button
                  className="btn"
                  style={{
                    flex: 1, minWidth: 140,
                    background: 'rgba(251, 191, 36, 0.15)',
                    color: 'var(--accent-yellow)',
                    border: '1px solid rgba(251, 191, 36, 0.3)',
                  }}
                  onClick={() => onApply?.(result.decisionId || result._id, 'with_discount')}
                  disabled={actionLoading}
                >
                  <Tag size={14} /> With Discount ₹{eventOverlay.finalCustomerPrice?.toLocaleString('en-IN')}
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1, minWidth: 140 }}
                  onClick={() => onApply?.(result.decisionId || result._id, 'without_discount')}
                  disabled={actionLoading}
                >
                  Without Discount ₹{eventOverlay.priceBeforeDiscount?.toLocaleString('en-IN')}
                </button>
              </>
            )}

            <button
              className="btn btn-danger"
              style={{ flex: '0 0 auto', minWidth: 100 }}
              onClick={() => onReject?.(result.decisionId || result._id)}
              disabled={actionLoading}
            >
              <X size={16} /> Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
