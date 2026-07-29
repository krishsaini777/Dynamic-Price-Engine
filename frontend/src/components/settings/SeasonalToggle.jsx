import React from 'react';
import { Sun } from 'lucide-react';

const ALL_CATEGORIES = ['Electronics', 'Clothing', 'Food', 'Books', 'Home', 'Sports', 'Beauty', 'Toys', 'Automotive', 'Other'];


export default function SeasonalToggle({
  seasonalEnabled,
  disabledCategories,
  onToggle,
  onUpdateCategory,
}) {
  const handleToggle = () => {
    onToggle(!seasonalEnabled);
  };

  const handleChipClick = (cat) => {
    const isDisabled = disabledCategories.includes(cat);
    onUpdateCategory(cat, !isDisabled);
  };

  // Build summary text
  let summaryText;
  if (!seasonalEnabled) {
    summaryText = 'Seasonal pricing is OFF globally';
  } else if (disabledCategories.length === 0) {
    summaryText = 'Seasonal pricing is ON for all categories';
  } else {
    summaryText = `Seasonal pricing is ON for all categories except: ${disabledCategories.join(', ')}`;
  }

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: 'rgba(234, 179, 8, 0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Sun size={18} color="var(--accent-yellow)" />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>Seasonal Pricing</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sigmoid ramp with 3-tier cascade</p>
        </div>

        {/* Toggle Switch */}
        <label style={{ position: 'relative', display: 'inline-block', width: 48, height: 26, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={seasonalEnabled}
            onChange={handleToggle}
            style={{ opacity: 0, width: 0, height: 0 }}
          />
          <span style={{
            position: 'absolute', inset: 0,
            borderRadius: 13,
            background: seasonalEnabled ? 'var(--accent-green)' : 'var(--bg-input)',
            border: `1px solid ${seasonalEnabled ? 'var(--accent-green)' : 'var(--border-color)'}`,
            transition: 'all 0.2s ease',
          }}>
            <span style={{
              position: 'absolute',
              top: 3, left: seasonalEnabled ? 23 : 3,
              width: 18, height: 18,
              borderRadius: '50%',
              background: '#fff',
              transition: 'left 0.2s ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }} />
          </span>
        </label>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: seasonalEnabled ? 'var(--accent-green)' : 'var(--text-muted)', minWidth: 30 }}>
          {seasonalEnabled ? 'ON' : 'OFF'}
        </span>
      </div>

      {/* Category exclusion chips — only when ON */}
      {seasonalEnabled && (
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            Category Exclusions
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {ALL_CATEGORIES.map((cat) => {
              const isDisabled = disabledCategories.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleChipClick(cat)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.3rem 0.75rem',
                    borderRadius: 9999,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: 'none',
                    transition: 'all 0.15s ease',
                    background: isDisabled ? 'rgba(239, 68, 68, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                    color: isDisabled ? 'var(--accent-red)' : 'var(--text-muted)',
                  }}
                >
                  {cat} {isDisabled && '✕'}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary text */}
      <div style={{
        padding: '0.65rem 0.85rem',
        borderRadius: 8,
        background: 'var(--bg-input)',
        fontSize: '0.8rem',
        color: 'var(--text-secondary)',
      }}>
        {summaryText}
      </div>
    </div>
  );
}
