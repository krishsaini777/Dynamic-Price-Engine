import React from 'react';

export default function LoadingSpinner({ size = 32, text = 'Loading...' }) {
  return (
    <div className="empty-state" style={{ padding: '2rem' }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        style={{ animation: 'spin 0.8s linear infinite', opacity: 0.7 }}
      >
        <circle cx="12" cy="12" r="10" stroke="var(--border-color)" strokeWidth="3" />
        <path
          d="M12 2 A10 10 0 0 1 22 12"
          stroke="var(--accent-indigo)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      {text && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
          {text}
        </p>
      )}
    </div>
  );
}
