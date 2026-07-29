import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { History, Check, X, ChevronDown } from 'lucide-react';
import { getProducts } from '../api/productApi';
import { getProductRecommendations, applyDecision, rejectDecision } from '../api/pricingApi';
import usePricing from '../hooks/usePricing';
import PricingForm from '../components/pricing/PricingForm';
import RecommendationCard from '../components/pricing/RecommendationCard';
import MLInsightsPanel from '../components/pricing/MLInsightsPanel';
import ConfidenceBadge from '../components/common/ConfidenceBadge';
import ErrorAlert from '../components/common/ErrorAlert';

// ── Date formatter ────────────────────────────────────────────────────────────
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Constants ─────────────────────────────────────────────────────────────────
const HISTORY_PAGE_SIZE = 10;

// ── Component ─────────────────────────────────────────────────────────────────
export default function PricingPage() {
  const [searchParams] = useSearchParams();
  const queryDecisionId = searchParams.get('decision');

  const [products, setProducts] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null); // null | 'apply' | 'reject' | string (rec._id)
  const [historyVisible, setHistoryVisible] = useState(HISTORY_PAGE_SIZE);
  const [historyActionLoading, setHistoryActionLoading] = useState(null); // rec._id being acted on

  const {
    result,
    selectedProductId,
    loading,
    error,
    setError,
    calculate,
    apply,
    reject,
    loadDecision,
    setSelectedProductId,
  } = usePricing();

  // ── Auto-dismiss error after 8 s ──────────────────────────────────────────
  const errorTimerRef = useRef(null);
  useEffect(() => {
    if (error) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => setError(null), 8000);
    }
    return () => clearTimeout(errorTimerRef.current);
  }, [error, setError]);

  // ── Fetch product list ────────────────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    try {
      const res = await getProducts();
      setProducts(res.data || []);
    } catch (err) {
      // Product list failure is non-critical — don't overwrite pricing errors
      console.error('[PricingPage] fetchProducts:', err?.message);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // ── Auto-load decision from URL query (dashboard link) ───────────────────
  const decisionLoaded = useRef(null);
  useEffect(() => {
    if (queryDecisionId && decisionLoaded.current !== queryDecisionId) {
      decisionLoaded.current = queryDecisionId;
      loadDecision(queryDecisionId).then((res) => {
        if (res?.product?._id) setSelectedProductId(res.product._id);
      }).catch(() => {});
    }
  }, [queryDecisionId, loadDecision, setSelectedProductId]);

  // ── Fetch history whenever selected product or result changes ────────────
  // getProductRecommendations returns the full API envelope: { success, data: [...] }
  // so we unwrap with res.data (the records array).
  const fetchHistory = useCallback(async (productId) => {
    if (!productId) return;
    setHistoryLoading(true);
    try {
      const envelope = await getProductRecommendations(productId);
      // envelope = { success: true, data: [...records] }
      const records = Array.isArray(envelope.data) ? envelope.data : [];
      setHistory(records);
      // Don't reset pagination on background refresh so the user doesn't lose their scroll position
    } catch {
      // non-critical — silently skip
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProductId) fetchHistory(selectedProductId);
  }, [selectedProductId, result, fetchHistory]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleCalculate = useCallback(async (productId) => {
    setSelectedProductId(productId);
    try {
      await calculate(productId);
    } catch {
      // error set by hook
    }
  }, [calculate, setSelectedProductId]);

  const handleApply = useCallback(async (decisionId, mode) => {
    setActionLoading('apply');
    try {
      await apply(decisionId, mode);
      // Refresh history + product list so price reflects everywhere
      if (selectedProductId) await fetchHistory(selectedProductId);
      fetchProducts();
    } catch {
      // error set by hook
    } finally {
      setActionLoading(null);
    }
  }, [apply, selectedProductId, fetchHistory, fetchProducts]);

  const handleReject = useCallback(async (decisionId) => {
    setActionLoading('reject');
    try {
      await reject(decisionId);
      if (selectedProductId) await fetchHistory(selectedProductId);
      fetchProducts();
    } catch {
      // error set by hook
    } finally {
      setActionLoading(null);
    }
  }, [reject, selectedProductId, fetchHistory, fetchProducts]);

  // ── History table inline apply/reject ────────────────────────────────────
  const handleHistoryAction = useCallback(async (id, action) => {
    setHistoryActionLoading(id);

    // Optimistic update — immediately reflect the status change in the UI
    // so the row responds at once without waiting for a network round-trip.
    const newStatus = action === 'apply' ? 'APPLIED' : 'REJECTED';
    setHistory((prev) =>
      prev.map((rec) => (rec._id === id ? { ...rec, status: newStatus } : rec))
    );

    try {
      if (action === 'apply') {
        await apply(id);
      } else {
        await reject(id);
      }
      // Background sync — reconcile with server truth
      if (selectedProductId) fetchHistory(selectedProductId);
      fetchProducts();
    } catch (err) {
      // Rollback the optimistic update on failure
      setHistory((prev) =>
        prev.map((rec) => (rec._id === id ? { ...rec, status: 'PENDING' } : rec))
      );
      setError(err?.message || `Failed to ${action} recommendation`);
    } finally {
      setHistoryActionLoading(null);
    }
  }, [selectedProductId, fetchHistory, fetchProducts, setError]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const isActionLoading = actionLoading !== null;
  const visibleHistory = history.slice(0, historyVisible);
  const hasMore = history.length > historyVisible;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Pricing Engine</h1>
          <p className="page-subtitle">Calculate optimized prices with multi-signal analysis</p>
        </div>
      </div>

      {/* Error banner — auto-dismisses after 8 s */}
      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {/* Split layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem', alignItems: 'start' }}>

        {/* ── Left Panel — Input ── */}
        <div style={{ position: 'sticky', top: '1.75rem' }}>
          <PricingForm
            products={products}
            onCalculate={handleCalculate}
            loading={loading}
            initialProductId={selectedProductId}
          />
        </div>

        {/* ── Right Panel — Results ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Empty state */}
          {!result && !loading && (
            <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '1rem' }}>
                Select a product and click <strong>Run Pricing Engine</strong> to see recommendations.
              </p>
              <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                The engine evaluates demand, inventory, competitors, and seasonal signals.
              </p>
            </div>
          )}

          {/* Loading spinner */}
          {loading && (
            <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
              <div style={{
                width: 36,
                height: 36,
                border: '3px solid var(--border-color)',
                borderTopColor: 'var(--accent-indigo)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 1rem',
              }} />
              <p style={{ color: 'var(--text-secondary)' }}>Running pricing engine...</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                Analyzing demand · inventory · competitors · seasonal trends
              </p>
            </div>
          )}

          {/* Recommendation card */}
          {result && (
            <>
              <RecommendationCard
                result={result}
                onApply={handleApply}
                onReject={handleReject}
                loading={loading}
                actionLoading={isActionLoading}
              />
              <MLInsightsPanel result={result} />
            </>
          )}

          {/* ── Pricing History Table ── */}
          {selectedProductId && (
            <div className="card" style={{ padding: '1.25rem' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <History size={16} color="var(--text-muted)" />
                <p style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--text-muted)',
                  flex: 1,
                }}>
                  Pricing History
                </p>
                {history.length > 0 && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {history.length} record{history.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Loading skeleton */}
              {historyLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {[1, 2, 3].map((i) => (
                    <div key={i} style={{ display: 'flex', gap: '1rem' }}>
                      <div style={{ flex: 2, height: 14, borderRadius: 4, background: 'var(--bg-input)', animation: 'pulse 1.5s infinite' }} />
                      <div style={{ flex: 1, height: 14, borderRadius: 4, background: 'var(--bg-input)', animation: 'pulse 1.5s infinite' }} />
                      <div style={{ flex: 1, height: 14, borderRadius: 4, background: 'var(--bg-input)', animation: 'pulse 1.5s infinite' }} />
                    </div>
                  ))}
                </div>
              ) : history.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem 0' }}>
                  No pricing history for this product yet.
                </p>
              ) : (
                <>
                  <div className="table-container" style={{ border: 'none' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Recommended</th>
                          <th>Adjustment</th>
                          <th>Confidence</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleHistory.map((rec) => {
                          const adj = rec.outcome?.adjustmentPercent || 0;
                          const adjColor =
                            adj > 0 ? 'var(--accent-green)'
                            : adj < 0 ? 'var(--accent-red)'
                            : 'var(--text-muted)';
                          const isRowLoading = historyActionLoading === rec._id;

                          return (
                            <tr
                              key={rec._id}
                              style={{ opacity: isRowLoading ? 0.6 : 1, transition: 'opacity 0.2s' }}
                            >
                              {/* Date */}
                              <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                {formatDate(rec.createdAt)}
                              </td>

                              {/* Recommended price */}
                              <td style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.85rem' }}>
                                ₹{rec.outcome?.recommendedPrice?.toLocaleString('en-IN') || '—'}
                              </td>

                              {/* Adjustment % */}
                              <td style={{ fontSize: '0.8rem' }}>
                                <span style={{ color: adjColor, fontFamily: 'monospace', fontWeight: 600 }}>
                                  {adj > 0 ? '+' : ''}{adj?.toFixed(1) || '0'}%
                                </span>
                              </td>

                              {/* Confidence badge */}
                              <td>
                                <ConfidenceBadge
                                  score={rec.outcome?.confidenceScore || 0}
                                  level={rec.outcome?.confidenceLevel}
                                />
                              </td>

                              {/* Status badge */}
                              <td>
                                <span className={`badge ${
                                  rec.status === 'APPLIED'  ? 'badge-green'  :
                                  rec.status === 'REJECTED' ? 'badge-red'    :
                                  rec.status === 'EXPIRED'  ? 'badge-gray'   :
                                  'badge-yellow'
                                }`}>
                                  {rec.status || 'PENDING'}
                                </span>
                              </td>

                              {/* Actions — only for PENDING records */}
                              <td style={{ textAlign: 'right' }}>
                                {rec.status === 'PENDING' && (
                                  <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                                    <button
                                      className="btn btn-success btn-sm"
                                      onClick={() => handleHistoryAction(rec._id, 'apply')}
                                      disabled={isRowLoading || historyActionLoading !== null}
                                      title="Apply this recommendation"
                                    >
                                      {isRowLoading ? (
                                        <span style={{
                                          display: 'inline-block',
                                          width: 12, height: 12,
                                          border: '2px solid rgba(255,255,255,0.3)',
                                          borderTopColor: '#fff',
                                          borderRadius: '50%',
                                          animation: 'spin 0.7s linear infinite',
                                        }} />
                                      ) : (
                                        <Check size={13} />
                                      )}
                                    </button>
                                    <button
                                      className="btn btn-danger btn-sm"
                                      onClick={() => handleHistoryAction(rec._id, 'reject')}
                                      disabled={isRowLoading || historyActionLoading !== null}
                                      title="Reject this recommendation"
                                    >
                                      {isRowLoading ? (
                                        <span style={{
                                          display: 'inline-block',
                                          width: 12, height: 12,
                                          border: '2px solid rgba(255,255,255,0.3)',
                                          borderTopColor: '#fff',
                                          borderRadius: '50%',
                                          animation: 'spin 0.7s linear infinite',
                                        }} />
                                      ) : (
                                        <X size={13} />
                                      )}
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Show More button */}
                  {hasMore && (
                    <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setHistoryVisible((v) => v + HISTORY_PAGE_SIZE)}
                        style={{ gap: '0.35rem' }}
                      >
                        <ChevronDown size={14} />
                        Show more ({history.length - historyVisible} remaining)
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
