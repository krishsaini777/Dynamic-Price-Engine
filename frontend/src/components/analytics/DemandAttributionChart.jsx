import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getDemandAttribution } from '../../api/analyticsApi';
import ErrorAlert from '../common/ErrorAlert';

/**
 * DemandAttributionChart — Stacked bar chart showing organic vs promotional demand.
 * Self-contained: fetches its own data via productId prop.
 *
 * Props:
 *   productId — string, the product to load attribution for
 */
export default function DemandAttributionChart({ productId }) {
  const [data, setData] = useState([]);
  const [stats, setStats] = useState({ organic: 0, promotional: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!productId) return;
    const fetchAttribution = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getDemandAttribution(productId);
        const { daily, organicPercentage, promotionalPercentage } = res.data || {};

        const transformed = (daily || []).map(item => ({
          date: item._id
            ? item._id
            : new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
          organicSales: item.organicSales ?? item.organicQuantity ?? 0,
          promotionalSales: item.promotionalSales ?? item.promoQuantity ?? 0,
        }));

        setData(transformed);
        setStats({
          organic: organicPercentage || 0,
          promotional: promotionalPercentage || 0,
        });
      } catch (err) {
        setError('Failed to load demand attribution.');
      } finally {
        setLoading(false);
      }
    };
    fetchAttribution();
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
        <p style={{ fontWeight: 600, marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
          Total: {payload.reduce((sum, entry) => sum + entry.value, 0)} units
        </p>
      </div>
    );
  };

  return (
    <div className="card" style={{ padding: '1.25rem', height: 380, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <p style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
          Demand Attribution
        </p>

        {!loading && data.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-blue)', padding: '0.25rem 0.5rem', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600 }}>
              {Math.round(stats.organic)}% Organic
            </span>
            <span style={{ background: 'rgba(249, 115, 22, 0.1)', color: 'var(--accent-orange)', padding: '0.25rem 0.5rem', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600 }}>
              {Math.round(stats.promotional)}% Promotional
            </span>
          </div>
        )}
      </div>

      {error && <ErrorAlert message={error} />}

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 30, height: 30, border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </div>
      ) : data.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          No sales data for this period.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
            <Bar dataKey="organicSales" name="Organic Sales" stackId="a" fill="var(--accent-blue)" radius={[0, 0, 4, 4]} />
            <Bar dataKey="promotionalSales" name="Promotional Sales" stackId="a" fill="var(--accent-orange)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
