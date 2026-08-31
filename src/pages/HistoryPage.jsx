import { useState } from 'react';
import { useTransactions } from '../hooks/useTransactions';
import { useWarehouses } from '../hooks/useWarehouses';
import { editTransaction, deleteTransaction } from '../lib/firestore';

function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString();
}

function TypeBadge({ type }) {
  const labels = { in: 'IN', out: 'OUT', transfer: 'TRANSFER' };
  return <span className={`badge badge-type badge-${type}`}>{labels[type] ?? type}</span>;
}

function TransactionRow({ tx, warehouses, onEdit, onDelete }) {
  const warehouseMap = Object.fromEntries(warehouses.map((w) => [w.id, w.name]));
  const perUnit =
    tx.type === 'in' && tx.totalPrice != null
      ? (tx.totalPrice / tx.quantity).toFixed(2)
      : null;

  return (
    <tr>
      <td><TypeBadge type={tx.type} /></td>
      <td className="product-name">{tx.productName}</td>
      <td className="text-right qty-cell">{tx.quantity}</td>
      <td>
        {tx.type === 'transfer'
          ? `${warehouseMap[tx.warehouseId] ?? tx.warehouseId} → ${warehouseMap[tx.toWarehouseId] ?? tx.toWarehouseId}`
          : warehouseMap[tx.warehouseId] ?? tx.warehouseId}
      </td>
      <td>
        {tx.totalPrice != null ? (
          <span title={`Total: ${tx.totalPrice}`}>
            {perUnit}/unit · {tx.totalPrice} total
          </span>
        ) : '—'}
      </td>
      <td>{tx.totalWeight != null ? `${tx.totalWeight} kg` : '—'}</td>
      <td className="note-cell">{tx.note ?? '—'}</td>
      <td className="date-cell">{formatDate(tx.createdAt)}</td>
      <td>{tx.editedAt ? <span className="edited-tag" title={formatDate(tx.editedAt)}>edited</span> : null}</td>
      <td>
        <div className="row-actions">
          <button className="btn btn-ghost btn-xs" onClick={() => onEdit(tx)}>Edit</button>
          <button className="btn btn-danger btn-xs" onClick={() => onDelete(tx.id)}>Delete</button>
        </div>
      </td>
    </tr>
  );
}

function EditModal({ tx, onClose, onSaved }) {
  const [form, setForm] = useState({
    quantity: tx.quantity,
    totalPrice: tx.totalPrice ?? '',
    totalWeight: tx.totalWeight ?? '',
    note: tx.note ?? '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await editTransaction(tx.id, form);
      onSaved();
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Edit Transaction</h2>
        <p className="modal-subtitle">{tx.productName} · {tx.type.toUpperCase()}</p>
        <form onSubmit={handleSave} className="form-grid">
          <div className="form-row">
            <label className="label">Quantity</label>
            <input
              type="number"
              className="input"
              value={form.quantity}
              onChange={(e) => set('quantity', e.target.value)}
              min="1"
              required
            />
          </div>
          {tx.type === 'in' && (
            <>
              <div className="form-row">
                <label className="label">Total Price <span className="optional">(optional)</span></label>
                <input
                  type="number"
                  className="input"
                  value={form.totalPrice}
                  onChange={(e) => set('totalPrice', e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="form-row">
                <label className="label">Total Weight (kg) <span className="optional">(optional)</span></label>
                <input
                  type="number"
                  className="input"
                  value={form.totalWeight}
                  onChange={(e) => set('totalWeight', e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
            </>
          )}
          <div className="form-row">
            <label className="label">Note <span className="optional">(optional)</span></label>
            <input
              type="text"
              className="input"
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className={`btn btn-primary${submitting ? ' loading' : ''}`} disabled={submitting}>
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const { transactions, loading, hasMore, loadMore } = useTransactions();
  const { warehouses } = useWarehouses();
  const [editingTx, setEditingTx] = useState(null);
  const [deleteErrors, setDeleteErrors] = useState({});
  const [loadingMore, setLoadingMore] = useState(false);

  async function handleDelete(id) {
    setDeleteErrors((prev) => ({ ...prev, [id]: null }));
    if (!window.confirm('Soft-delete this transaction? Stock levels will be reversed.')) return;
    try {
      await deleteTransaction(id);
    } catch (err) {
      setDeleteErrors((prev) => ({ ...prev, [id]: err.message }));
    }
  }

  async function handleLoadMore() {
    setLoadingMore(true);
    await loadMore();
    setLoadingMore(false);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Transaction History</h1>
      </div>

      {loading ? (
        <div className="loading-spinner">Loading…</div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="data-table history-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Product</th>
                  <th className="text-right">Qty</th>
                  <th>Warehouse</th>
                  <th>Price</th>
                  <th>Weight</th>
                  <th>Note</th>
                  <th>Date</th>
                  <th></th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 && (
                  <tr><td colSpan={10} className="empty-cell">No transactions yet.</td></tr>
                )}
                {transactions.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    tx={tx}
                    warehouses={warehouses}
                    onEdit={setEditingTx}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {Object.entries(deleteErrors).map(([id, err]) =>
            err ? <p key={id} className="error-text">{err}</p> : null
          )}

          {hasMore && (
            <div className="load-more">
              <button
                id="load-more-btn"
                className={`btn btn-ghost${loadingMore ? ' loading' : ''}`}
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading…' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}

      {editingTx && (
        <EditModal
          tx={editingTx}
          onClose={() => setEditingTx(null)}
          onSaved={() => setEditingTx(null)}
        />
      )}
    </div>
  );
}
