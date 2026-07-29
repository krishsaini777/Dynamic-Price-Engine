import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Gauge } from 'lucide-react';
import Modal from '../common/Modal';

export default function SettingsPanel({
  eventsEnabled,
  maxGlobalDiscount,
  schedulerEnabled,
  schedulerInterval,
  autoApplyThreshold,
  seasonalEnabled,
  onUpdateScheduler,
}) {
  const [interval, setInterval_] = useState(schedulerInterval);
  const [threshold, setThreshold] = useState(autoApplyThreshold);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    setInterval_(schedulerInterval);
    setThreshold(autoApplyThreshold);
  }, [schedulerInterval, autoApplyThreshold]);

  const handleToggleEvents = () => {
    onUpdateScheduler('eventsEnabled', !eventsEnabled);
  };

  const handleToggleScheduler = () => {
    onUpdateScheduler('schedulerEnabled', !schedulerEnabled);
  };

  const hasChanges = Number(interval) !== schedulerInterval || Number(threshold) !== autoApplyThreshold;

  const handleConfirmSave = async () => {
    setShowConfirm(false);
    const validInterval = Math.max(1, Math.min(1440, Number(interval)));
    const validThreshold = Math.max(0, Math.min(1, Number(threshold)));
    
    if (validInterval !== schedulerInterval) {
      await onUpdateScheduler('schedulerIntervalMinutes', validInterval);
    }
    if (validThreshold !== autoApplyThreshold) {
      await onUpdateScheduler('autoApplyThreshold', validThreshold);
    }
  };

  // Shared toggle renderer
  const Toggle = ({ checked, onChange, label }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
      <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>{label}</span>
      <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer' }}>
        <input type="checkbox" checked={checked} onChange={onChange} style={{ opacity: 0, width: 0, height: 0 }} />
        <span style={{
          position: 'absolute', inset: 0, borderRadius: 12,
          background: checked ? 'var(--accent-green)' : 'var(--bg-input)',
          border: `1px solid ${checked ? 'var(--accent-green)' : 'var(--border-color)'}`,
          transition: 'all 0.2s ease',
        }}>
          <span style={{
            position: 'absolute', top: 3, left: checked ? 21 : 3,
            width: 16, height: 16, borderRadius: '50%', background: '#fff',
            transition: 'left 0.2s ease', boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
          }} />
        </span>
      </label>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Card 1 — Events System */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Calendar size={16} color="var(--accent-purple)" />
          <p style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
            Events System
          </p>
        </div>
        <Toggle checked={eventsEnabled} onChange={handleToggleEvents} label="Events System Enabled" />
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.5rem 0.75rem', background: 'var(--bg-input)', borderRadius: 6 }}>
          Max discount allowed: <strong>{Math.round(maxGlobalDiscount * 100)}%</strong>
        </div>
      </div>

      {/* Card 2 — Scheduler */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Clock size={16} color="var(--accent-blue)" />
          <p style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
            Scheduler
          </p>
        </div>
        <Toggle checked={schedulerEnabled} onChange={handleToggleScheduler} label="Auto-Scheduler Enabled" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
          <div>
            <label className="label">Interval (minutes)</label>
            <input
              className="input"
              type="number"
              min="1"
              max="1440"
              value={interval}
              onChange={(e) => setInterval_(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Auto-apply threshold</label>
            <input
              className="input"
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
          </div>
        </div>
        {hasChanges && (
          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => { setInterval_(schedulerInterval); setThreshold(autoApplyThreshold); }}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowConfirm(true)}>Save Settings</button>
          </div>
        )}
      </div>

      {/* Card 3 — Summary */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Gauge size={16} color="var(--accent-orange)" />
          <p style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
            Summary
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <p>
            Seasonal pricing is{' '}
            <strong style={{ color: seasonalEnabled ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              {seasonalEnabled ? 'ON' : 'OFF'}
            </strong>
          </p>
          <p>
            Scheduler runs every <strong>{schedulerInterval}</strong> minutes
          </p>
          <p>
            Auto-applies when confidence ≥ <strong>{autoApplyThreshold}</strong>
          </p>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal isOpen={showConfirm} onClose={() => setShowConfirm(false)} title="Confirm Scheduler Changes">
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
          Are you sure you want to update the Auto-Scheduler settings?
        </p>
        <ul style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem', paddingLeft: '1.2rem', lineHeight: 1.6 }}>
          {Number(interval) !== schedulerInterval && (
            <li>Change interval from <strong>{schedulerInterval}</strong> to <strong>{interval}</strong> minutes</li>
          )}
          {Number(threshold) !== autoApplyThreshold && (
            <li>Change auto-apply threshold from <strong>{autoApplyThreshold}</strong> to <strong>{threshold}</strong></li>
          )}
        </ul>
        <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
          <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleConfirmSave}>Confirm Update</button>
        </div>
      </Modal>
    </div>
  );
}
