import React from 'react';

const statusConfig = {
  DRAFT:     { className: 'badge-gray',   label: 'DRAFT' },
  SCHEDULED: { className: 'badge-blue',   label: 'SCHEDULED' },
  ACTIVE:    { className: 'badge-green',  label: 'ACTIVE' },
  INACTIVE:  { className: 'badge-orange', label: 'INACTIVE' },
  EXPIRED:   { className: 'badge-red',    label: 'EXPIRED' },
};

export default function EventStatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.DRAFT;
  return <span className={`badge ${config.className}`}>{config.label}</span>;
}
