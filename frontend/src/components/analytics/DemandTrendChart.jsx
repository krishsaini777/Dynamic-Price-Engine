import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getDemandTrends } from '../../api/analyticsApi';
import ErrorAlert from '../common/ErrorAlert';

/**
 * DemandTrendChart — Line chart showing demand velocity over time.
 * Self-contained: fetches its own data via productId prop.
 *
 * Props:
 *   productId — string, the product to load trends for
 */
export default function DemandTrendChart({ productId }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [organicOnly, setOrganicOnly] = useState(false);

  useEffect(() => {
    if (!productId) return;
    const fetchTrends = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getDemandTrends(productId);
        const transformed = (res.data || []).map(item => ({
          // Support both API shapes
          date: item._id
            ? item._id
            : new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
          organicSales: item.organicSales ?? item.organicQuantity ?? 0,
          promotionalSales: item.promotionalSales ?? item.promoQuantity ?? 0,
          totalSales: (item.organicSales ?? item.organicQuantity ?? 0) + (item.promotionalSales ?? item.promoQuantity ?? 0),
        }));
        setData(transformed);
      } catch (err) {
        setError('Failed to load demand trends.');
      } finally {
        setLoading(false);
      }
    };
    fetchTrends();
  }, [productId]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.75rem', fontSize: '0.85rem' }}>
        <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color, fontWeight: 500 }}>
            {entry.name}: {entry.value} units
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="card" style={{ padding: '1.25rem', height: 340, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <p style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
          Demand Velocity Trends
        </p>

        {/* Toggle switch */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>All Demand</span>
          <label style={{ position: 'relative', display: 'inline-block', width: 36, height: 20, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={organicOnly}
              onChange={(e) => setOrganicOnly(e.target.checked)}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span style={{
              position: 'absolute', inset: 0, borderRadius: 10,
              background: organicOnly ? 'var(--accent-blue)' : 'var(--bg-input)',
              border: `1px solid ${organicOnly ? 'var(--accent-blue)' : 'var(--border-color)'}`,
              transition: 'all 0.2s ease'
            }}>
              <span style={{
                position: 'absolute', top: 2, left: organicOnly ? 18 : 2,
                width: 14, height: 14, borderRadius: '50%', background: '#fff',
                transition: 'left 0.2s ease', boxShadow: '0 1px 2px rgba(0,0,0,0.3)'
              }} />
            </span>
          </label>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Organic Only</span>
        </div>
      </div>

      {error && <ErrorAlert message={error} />}

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 30, height: 30, border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-orange)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </div>
      ) : data.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          No demand data available.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
            <Line
              type="monotone"
              dataKey="organicSales"
              name="Organic Sales"
              stroke="var(--accent-blue)"
              strokeWidth={2}
              dot={{ r: 3, fill: 'var(--accent-blue)' }}
              activeDot={{ r: 5 }}
            />
            {!organicOnly && (
              <Line
                type="monotone"
                dataKey="promotionalSales"
                name="Promotional Sales"
                stroke="var(--accent-orange)"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 3, fill: 'var(--accent-orange)' }}
                activeDot={{ r: 5 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
