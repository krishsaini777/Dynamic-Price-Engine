import React from 'react';
import { Package, RefreshCw, ShoppingCart } from 'lucide-react';
import CoverageMeter from './CoverageMeter';

const statusBadge = {
  critical: 'badge-red',
  low: 'badge-orange',
  normal: 'badge-green',
  high: 'badge-blue',
  unknown: 'badge-gray',
};

export default function InventoryTable({ inventory, onUpdateStock, onRecordSale }) {
  if (inventory.length === 0) {
    return (
      <div className="empty-state">
        <Package size={40} />
        <p>No inventory records found. Add products first, then set their inventory.</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Qty</th>
            <th>EMA Sales/Day</th>
            <th>Coverage</th>
            <th>Status</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {inventory.map((item) => {
            const product = item.productId || {};
            const status = item.inventoryStatus || 'unknown';

            return (
              <tr key={item._id}>
                <td>
                  <div>
                    <span style={{ fontWeight: 500 }}>{product.productName || 'Unknown'}</span>
                    <br />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      ₹{product.currentPrice?.toLocaleString('en-IN') ?? '—'}
                    </span>
                  </div>
                </td>
                <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                  {item.availableQuantity}
                </td>
                <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                  {item.emaDailySales != null ? item.emaDailySales.toFixed(1) : '—'}
                </td>
                <td>
                  <CoverageMeter coverageDays={item.coverageDays} />
                </td>
                <td>
                  <span className={`badge ${statusBadge[status]}`}>
                    {status.toUpperCase()}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => onUpdateStock(item)}
                      title="Update stock"
                    >
                      <RefreshCw size={14} /> Stock
                    </button>
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => onRecordSale(item)}
                      title="Record a sale"
                    >
                      <ShoppingCart size={14} /> Sale
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
