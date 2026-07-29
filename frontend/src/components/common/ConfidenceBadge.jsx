import React from 'react';

const tierConfig = {
  HIGH: { className: 'badge-green', label: 'HIGH' },
  MEDIUM: { className: 'badge-yellow', label: 'MEDIUM' },
  LOW: { className: 'badge-red', label: 'LOW' },
};

export default function ConfidenceBadge({ score, level }) {
  // Derive level from score if not provided
  const derivedLevel = level || (score >= 0.7 ? 'HIGH' : score >= 0.4 ? 'MEDIUM' : 'LOW');
  const config = tierConfig[derivedLevel] || tierConfig.MEDIUM;
  const pct = Math.round((score ?? 0) * 100);

  return (
    <span className={`badge ${config.className}`}>
      {config.label} · {pct}%
    </span>
  );
}
