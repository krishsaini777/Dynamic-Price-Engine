import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { getPriceHistory } from '../../api/analyticsApi';
import ErrorAlert from '../common/ErrorAlert';

/**
 * PriceHistoryChart — Line chart showing price changes over time.
 * Self-contained: fetches its own data via productId prop.
 *
 * Props:
 *   productId — string, the product to load history for
 */
export default function PriceHistoryChart({ productId }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!productId) return;
    const fetchHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getPriceHistory(productId);
        const transformed = (res.data || []).map(item => ({
          date: new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
          recommendedPrice: item.recommendedPrice ?? item.newPrice,
          currentPrice: item.currentPrice ?? item.previousPrice,
        }));
        setData(transformed);
      } catch (err) {
        setError('Failed to load price history.');
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [productId]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.75rem', fontSize: '0.85rem' }}>
        <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color, fontWeight: 500 }}>
            {entry.name}: ₹{entry.value?.toLocaleString('en-IN')}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="card" style={{ padding: '1.25rem', height: 340, display: 'flex', flexDirection: 'column' }}>
      <p style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: '1rem' }}>
        Price History
      </p>

      {error && <ErrorAlert message={error} />}

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 30, height: 30, border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </div>
      ) : data.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          No price history data available.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
            <Line type="monotone" dataKey="currentPrice" name="Actual Price" stroke="var(--accent-green)" strokeWidth={2} dot={{ r: 3, fill: 'var(--accent-green)' }} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="recommendedPrice" name="Recommended Price" stroke="var(--accent-blue)" strokeWidth={2} dot={{ r: 3, fill: 'var(--accent-blue)' }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
