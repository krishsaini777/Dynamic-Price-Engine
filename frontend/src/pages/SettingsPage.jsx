import React, { useState, useEffect } from 'react';
import useSettings from '../hooks/useSettings';
import SeasonalToggle from '../components/settings/SeasonalToggle';
import SettingsPanel from '../components/settings/SettingsPanel';
import ErrorAlert from '../components/common/ErrorAlert';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function SettingsPage() {
  const {
    seasonalEnabled, disabledCategories,
    schedulerEnabled, schedulerInterval, autoApplyThreshold,
    eventsEnabled, maxGlobalDiscount,
    loading, error, setError,
    toggleSeasonal, updateCategory, updateScheduler,
  } = useSettings();

  const [toast, setToast] = useState(null);

  // Show success toast on any setting save
  const wrapSave = (fn) => async (...args) => {
    try {
      await fn(...args);
      setToast('Setting saved ✓');
    } catch (err) {
      // error handled by hook
    }
  };

  // Auto-dismiss toast after 2s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  if (loading) {
    return (
      <div className="animate-fade-in" style={{ padding: '2rem 0' }}>
        <div className="page-header">
          <div>
            <h1 className="page-title">Settings</h1>
            <p className="page-subtitle">Configure pricing engine behavior</p>
          </div>
        </div>
        <LoadingSpinner text="Loading settings..." />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Configure pricing engine behavior</p>
        </div>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {/* 2-column layout on large screens */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
        gap: '1.5rem',
        alignItems: 'start',
      }}>
        {/* Left column — Seasonal Toggle */}
        <SeasonalToggle
          seasonalEnabled={seasonalEnabled}
          disabledCategories={disabledCategories}
          onToggle={wrapSave(toggleSeasonal)}
          onUpdateCategory={wrapSave(updateCategory)}
        />

        {/* Right column — Settings Panel */}
        <SettingsPanel
          eventsEnabled={eventsEnabled}
          maxGlobalDiscount={maxGlobalDiscount}
          schedulerEnabled={schedulerEnabled}
          schedulerInterval={schedulerInterval}
          autoApplyThreshold={autoApplyThreshold}
          seasonalEnabled={seasonalEnabled}
          onUpdateScheduler={wrapSave(updateScheduler)}
        />
      </div>

      {/* Success toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          padding: '0.75rem 1.25rem',
          borderRadius: 10,
          background: 'rgba(34, 197, 94, 0.15)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          color: 'var(--accent-green)',
          fontSize: '0.85rem',
          fontWeight: 600,
          animation: 'fadeIn 0.2s ease-out',
          zIndex: 100,
          backdropFilter: 'blur(8px)',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
