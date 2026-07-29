import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  ReferenceLine, CartesianGrid, LabelList
} from 'recharts';

/**
 * SignalBreakdown — Bar chart showing the % impact of each pricing signal.
 *
 * Props:
 *   signals — { demand, inventory, competitor, seasonal }
 */
export default function SignalBreakdown({ signals }) {
  const data = useMemo(() => {
    if (!signals) return [];

    const getImpact = (multiplier) => {
      const mult = multiplier ?? 1;
      return parseFloat(((mult - 1) * 100).toFixed(1));
    };

    return [
      { name: 'Demand',     impact: getImpact(signals.demand?.multiplier)     },
      { name: 'Inventory',  impact: getImpact(signals.inventory?.multiplier)  },
      { name: 'Competitor', impact: getImpact(signals.competitor?.multiplier) },
      { name: 'Seasonal',   impact: getImpact(signals.seasonal?.multiplier)   },
    ];
  }, [signals]);

  if (data.length === 0) return null;

  const maxAbs = Math.max(5, ...data.map((d) => Math.abs(d.impact)));
  // Add more headroom for labels
  const yLimit = Math.ceil(maxAbs * 1.5);

  // ── Custom Tooltip ──────────────────────────────────────────────────────────
  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload;
    const color =
      d.impact > 0 ? 'var(--accent-green)'
      : d.impact < 0 ? 'var(--accent-red)'
      : 'var(--text-muted)';
    return (
      <div style={{
        background: 'rgba(23, 25, 35, 0.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        padding: '0.75rem 1rem',
        fontSize: '0.85rem',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        color: '#fff'
      }}>
        <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem' }}>
          {d.name} Signal
        </p>
        <p style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Impact:{' '}
          <strong style={{ color, fontSize: '1.1rem', textShadow: `0 0 8px ${color}40` }}>
            {d.impact > 0 ? '+' : ''}{d.impact}%
          </strong>
        </p>
      </div>
    );
  };

  // ── Custom Label — rendered above/below bar ─────────────────────────────────
  const CustomBarLabel = (props) => {
    const { x, y, width, height, value } = props;
    if (value === undefined || value === null) return null;

    const label = value === 0 ? '0%' : `${value > 0 ? '+' : ''}${value}%`;
    const isPositive = value >= 0;

    // For Recharts: if height < 0, y is ALREADY the bottom of the bar.
    // So for negative bars, we just add to y to place it below the bar.
    const labelY = isPositive ? y - 12 : y + 18;
    const color =
      value > 0 ? 'var(--accent-green)'
      : value < 0 ? 'var(--accent-red)'
      : 'var(--text-muted)';

    return (
      <text
        x={x + width / 2}
        y={labelY}
        fill={color}
        textAnchor="middle"
        dominantBaseline="auto"
        fontSize={12}
        fontWeight={700}
        style={{ textShadow: `0 2px 4px rgba(0,0,0,0.5)` }}
      >
        {label}
      </text>
    );
  };

  // ── Custom Bar Shape — rounded corners in correct direction ─────────────────
  const RoundedBar = (props) => {
    const { x, y, width, height, fill, payload } = props;
    const r = 6; // slightly rounder
    const absH = Math.abs(height || 0);

    // Recharts behavior: for negative values, height is negative and y is the bottom of the bar.
    // actualY is normalized to always be the top-most pixel coordinate of the bar.
    const actualY = height < 0 ? y + height : y;

    // For zero-impact signals draw a thin neutral line at the baseline
    if (!height || absH < 2) {
      return (
        <rect
          x={x}
          y={actualY - 1}
          width={width}
          height={2}
          fill="rgba(255,255,255,0.15)"
          rx={2}
        />
      );
    }

    const isPositive = (payload?.impact ?? 0) >= 0;

    if (isPositive) {
      const safeR = Math.min(r, absH / 2);
      return (
        <path
          d={`M${x + safeR},${actualY}
             h${width - 2 * safeR}
             a${safeR},${safeR} 0 0 1 ${safeR},${safeR}
             v${absH - safeR}
             h${-width}
             v${-(absH - safeR)}
             a${safeR},${safeR} 0 0 1 ${safeR},${-safeR}z`}
          fill={fill}
        />
      );
    } else {
      const safeR = Math.min(r, absH / 2);
      return (
        <path
          d={`M${x},${actualY}
             h${width}
             v${absH - safeR}
             a${safeR},${safeR} 0 0 1 ${-safeR},${safeR}
             h${-(width - 2 * safeR)}
             a${safeR},${safeR} 0 0 1 ${-safeR},${-safeR}
             v${-(absH - safeR)}z`}
          fill={fill}
        />
      );
    }
  };

  return (
    <div className="card" style={{ padding: '1.5rem', background: 'linear-gradient(180deg, var(--bg-card) 0%, rgba(20, 22, 30, 0.95) 100%)' }}>
      <p style={{
        fontSize: '0.8rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--text-primary)',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <span style={{ width: 4, height: 16, background: 'var(--accent-indigo)', borderRadius: 2 }} />
        Signal Impact Breakdown
      </p>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          data={data}
          margin={{ top: 32, right: 16, left: 0, bottom: 24 }} // Increased bottom margin to prevent XAxis label overlap
        >
          <defs>
            <linearGradient id="colorPos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-green)" stopOpacity={0.9} />
              <stop offset="100%" stopColor="var(--accent-green)" stopOpacity={0.2} />
            </linearGradient>
            <linearGradient id="colorNeg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-red)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="var(--accent-red)" stopOpacity={0.9} />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          <CartesianGrid
            strokeDasharray="4 4"
            stroke="rgba(255,255,255,0.06)"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
            dy={8} // Push labels down slightly
          />
          <YAxis
            domain={[-yLimit, yLimit]}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
            width={46}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
          />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeWidth={2} />

          <Bar
            dataKey="impact"
            maxBarSize={56}
            shape={<RoundedBar />}
            isAnimationActive={true}
            animationDuration={1200}
            animationEasing="ease-out"
          >
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={
                  d.impact > 0 ? 'url(#colorPos)'
                  : d.impact < 0 ? 'url(#colorNeg)'
                  : 'rgba(255,255,255,0.1)'
                }
                filter={d.impact !== 0 ? 'url(#glow)' : ''}
              />
            ))}
            <LabelList dataKey="impact" content={<CustomBarLabel />} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
