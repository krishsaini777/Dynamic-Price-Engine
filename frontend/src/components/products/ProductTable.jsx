import React, { useState, useMemo } from 'react';
import { Pencil, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import ProductTierBadge from './ProductTierBadge';

const columns = [
  { key: 'sku',          label: 'SKU' },
  { key: 'productName',  label: 'Product' },
  { key: 'category',     label: 'Category' },
  { key: 'costPrice',    label: 'Cost (₹)' },
  { key: 'currentPrice', label: 'Price (₹)' },
  { key: 'tier',         label: 'Tier' },
];

export default function ProductTable({ products, onEdit, onDelete }) {
  const [sortKey, setSortKey] = useState('productName');
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sorted = useMemo(() => {
    return [...products].sort((a, b) => {
      const aVal = a[sortKey] ?? '';
      const bVal = b[sortKey] ?? '';
      if (typeof aVal === 'number') return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      return sortDir === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [products, sortKey, sortDir]);

  if (products.length === 0) {
    return (
      <div className="empty-state">
        <p>No products found. Add your first product to get started.</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className={sortKey === col.key ? 'sorted' : ''}
              >
                {col.label}
                <span className="sort-icon">
                  {sortKey === col.key ? (
                    sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                  ) : (
                    <ChevronUp size={12} />
                  )}
                </span>
              </th>
            ))}
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((product) => (
            <tr key={product._id}>
              <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {product.sku}
              </td>
              <td style={{ fontWeight: 500 }}>{product.productName}</td>
              <td>
                <span className="badge badge-gray">{product.category}</span>
              </td>
              <td style={{ fontFamily: 'monospace' }}>₹{product.costPrice?.toLocaleString('en-IN')}</td>
              <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent-green)' }}>
                ₹{product.currentPrice?.toLocaleString('en-IN')}
              </td>
              <td>
                <ProductTierBadge tier={product.tier} />
              </td>
              <td style={{ textAlign: 'right' }}>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => onEdit(product)}>
                    <Pencil size={14} />
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => onDelete(product)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
