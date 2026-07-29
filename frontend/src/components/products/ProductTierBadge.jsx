import React from 'react';

const tierConfig = {
  budget:  { label: 'Budget',  className: 'badge-green' },
  mid:     { label: 'Mid',     className: 'badge-blue' },
  premium: { label: 'Premium', className: 'badge-purple' },
};

export default function ProductTierBadge({ tier }) {
  const config = tierConfig[tier] || tierConfig.mid;
  return <span className={`badge ${config.className}`}>{config.label}</span>;
}
