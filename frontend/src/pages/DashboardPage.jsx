import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, AlertCircle, DollarSign, Activity, TrendingUp, Tag, Timer, AlertTriangle } from 'lucide-react';
import useDashboard from '../hooks/useDashboard';
import { getCriticalInventory } from '../api/inventoryApi';
import { getActiveEvents } from '../api/eventApi';
import StatCard from '../components/common/StatCard';
import ErrorAlert from '../components/common/ErrorAlert';
import ConfidenceBadge from '../components/common/ConfidenceBadge';

/* ─── Skeleton Placeholders ─── */
function SkeletonStatCard() {
  return (
    <div className="card" style={{ padding: '1.25rem', height: 100 }}>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--bg-input)', animation: 'pulse 1.5s infinite' }} />
        <div style={{ flex: 1 }}>
          <div style={{ width: '60%', height: 10, borderRadius: 4, background: 'var(--bg-input)', animation: 'pulse 1.5s infinite', marginBottom: 8 }} />
          <div style={{ width: '40%', height: 18, borderRadius: 4, background: 'var(--bg-input)', animation: 'pulse 1.5s infinite' }} />
        </div>
      </div>
    </div>
  );
}

function SkeletonTable({ rows = 3 }) {
  return (
    <div className="card" style={{ padding: '1rem' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: '1rem', marginBottom: i < rows - 1 ? '0.75rem' : 0 }}>
          <div style={{ flex: 2, height: 14, borderRadius: 4, background: 'var(--bg-input)', animation: 'pulse 1.5s infinite' }} />
          <div style={{ flex: 1, height: 14, borderRadius: 4, background: 'var(--bg-input)', animation: 'pulse 1.5s infinite' }} />
          <div style={{ flex: 1, height: 14, borderRadius: 4, background: 'var(--bg-input)', animation: 'pulse 1.5s infinite' }} />
        </div>
      ))}
    </div>
  );
}

/* ─── Countdown helper ─── */
function countdown(endDateStr) {
  if (!endDateStr) return 'N/A';
  const diff = new Date(endDateStr).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((diff % 3600000) / 60000);
  return `${hours}h ${mins}m`;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { stats, loading, error, setError, fetchStats } = useDashboard();
  const [criticalItems, setCriticalItems] = useState([]);
  const [activeEvents, setActiveEvents] = useState([]);

  const secondaryFetched = React.useRef(false);
  // Fetch additional data after stats load
  useEffect(() => {
    if (stats && !secondaryFetched.current) {
      secondaryFetched.current = true;
      (async () => {
        try {
          const [critRes, eventsRes] = await Promise.allSettled([
            getCriticalInventory(),
            getActiveEvents(),
          ]);
          if (critRes.status === 'fulfilled') setCriticalItems((critRes.value.data || []).slice(0, 5));
          if (eventsRes.status === 'fulfilled') setActiveEvents(eventsRes.value.data || []);
        } catch (e) {
          // non-critical — don't block dashboard
        }
      })();
    }
  }, [stats]);

  // Recent recommendations from stats
  const recentRecs = stats?.recentRecommendations || stats?.pricing?.recentRecommendations || [];

  /* ─── Loading State ─── */
  if (loading) {
    return (
      <div className="animate-fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Real-time pricing engine overview</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {Array.from({ length: 5 }).map((_, i) => <SkeletonStatCard key={i} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <SkeletonTable rows={3} />
          <SkeletonTable rows={3} />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Real-time pricing engine overview</p>
        </div>
      </div>

      {error && (
        <ErrorAlert message={error} onDismiss={() => setError(null)}>
          <button className="btn btn-secondary btn-sm" onClick={fetchStats} style={{ marginTop: '0.5rem' }}>
            Retry
          </button>
        </ErrorAlert>
      )}

      {/* KPI StatCards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>
        <StatCard icon={<Package />} label="Active Products" value={stats?.products?.active ?? 0} subtitle={`${stats?.products?.pricedToday ?? 0} priced today`} color="var(--accent-blue)" />
        <StatCard icon={<AlertCircle />} label="Critical Stock" value={stats?.inventory?.critical ?? 0} subtitle={`${stats?.inventory?.low ?? 0} low stock`} color="var(--accent-red)" />
        <StatCard icon={<DollarSign />} label="Pending Prices" value={stats?.pricing?.pendingRecommendations ?? 0} subtitle={`${stats?.pricing?.appliedToday ?? 0} applied today`} color="var(--accent-orange)" />
        <StatCard icon={<TrendingUp />} label="Avg Confidence" value={`${Math.round((stats?.pricing?.avgConfidenceScore ?? 0) * 100)}%`} subtitle={`±${stats?.pricing?.avgAdjustmentPercent ?? 0}% avg change`} color="var(--accent-green)" />
        <StatCard icon={<Activity />} label="Active Events" value={stats?.events?.activeEvents ?? 0} subtitle={`${stats?.events?.upcomingEvents ?? 0} upcoming`} color="var(--accent-purple)" />
      </div>

      {/* Two-column widget grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.25rem' }}>

        {/* Active Promotions Widget */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Tag size={16} color="var(--accent-purple)" />
            <p style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
              Active Promotions
            </p>
          </div>
          {activeEvents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No active promotions running
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {activeEvents.map((ev) => (
                <div key={ev._id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.6rem 0.85rem', background: 'var(--bg-input)', borderRadius: 8,
                }}>
                  <div>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{ev.eventName}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {ev.discountType === 'percentage' ? `${ev.discountValue}% off` : ev.discountType === 'flat_amount' ? `₹${ev.discountValue} off` : `→ ₹${ev.discountValue}`}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--accent-orange)', fontWeight: 600 }}>
                    <Timer size={14} />
                    Ends in {countdown(ev.endDate)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Recommendations Widget */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <DollarSign size={16} color="var(--accent-green)" />
            <p style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
              Recent Recommendations
            </p>
          </div>
          {recentRecs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No recommendations yet
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Price</th>
                    <th>Confidence</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRecs.slice(0, 5).map((rec, i) => (
                    <tr
                      key={rec._id || i}
                      onClick={() => {
                        if (rec._id) {
                          navigate(`/pricing?decision=${rec._id}`);
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                      className="hover-bg"
                    >
                      <td style={{ fontWeight: 500, fontSize: '0.8rem' }}>{rec.productId?.productName || '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.8rem' }}>
                        ₹{rec.outcome?.recommendedPrice?.toLocaleString('en-IN') || '—'}
                      </td>
                      <td>
                        <ConfidenceBadge
                          score={rec.outcome?.confidenceScore ?? 0}
                          level={rec.outcome?.confidenceLevel}
                        />
                      </td>
                      <td>
                        <span className={`badge ${rec.status === 'APPLIED' ? 'badge-green' : rec.status === 'REJECTED' ? 'badge-red' : 'badge-yellow'}`}>
                          {rec.status || 'PENDING'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Inventory Coverage Widget */}
        <div className="card" style={{ padding: '1.25rem', gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <AlertTriangle size={16} color="var(--accent-red)" />
            <p style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
              Critical Inventory — Low Stock Items
            </p>
          </div>
          {criticalItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              All products have adequate stock levels ✓
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Stock</th>
                    <th>Coverage</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {criticalItems.map((item, i) => {
                    const isCritical = item.inventoryStatus === 'critical';
                    return (
                      <tr key={item._id || i} style={isCritical ? { background: 'rgba(239, 68, 68, 0.08)' } : undefined}>
                        <td style={{ fontWeight: 500, fontSize: '0.85rem' }}>
                          {item.productId?.productName || item.productName || '—'}
                        </td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                          {item.availableQuantity ?? 0}
                        </td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600, color: isCritical ? 'var(--accent-red)' : 'var(--accent-orange)' }}>
                          {item.coverageDays?.toFixed(1) ?? '—'} days
                        </td>
                        <td>
                          <span className={`badge ${isCritical ? 'badge-red' : 'badge-orange'}`}>
                            {item.inventoryStatus?.toUpperCase() || 'UNKNOWN'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
