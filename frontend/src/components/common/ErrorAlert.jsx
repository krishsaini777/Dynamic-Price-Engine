import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ErrorAlert({ message, onDismiss, children }) {
  if (!message) return null;

  return (
    <div
      className="animate-fade-in"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '0.875rem 1rem',
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '10px',
        marginBottom: '1rem',
      }}
    >
      <AlertTriangle size={18} color="var(--accent-red)" style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: '0.85rem', color: 'var(--accent-red)', lineHeight: 1.5 }}>
          {message}
        </p>
        {children}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <X size={16} color="var(--accent-red)" />
        </button>
      )}
    </div>
  );
}
