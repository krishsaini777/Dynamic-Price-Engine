import React from 'react';

export default function StatCard({ icon, label, value, subtitle, color = 'var(--accent-indigo)' }) {
  return (
    <div className="card animate-fade-in" style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 10,
          background: `${color}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon && React.cloneElement(icon, { size: 20, color })}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
          {label}
        </p>
        <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2, marginTop: '0.15rem' }}>
          {value ?? '—'}
        </p>
        {subtitle && (
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
