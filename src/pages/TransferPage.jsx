import { useState } from 'react';
import { useProducts } from '../hooks/useProducts';
import { useWarehouses } from '../hooks/useWarehouses';
import { transferStock } from '../lib/firestore';

export default function TransferPage() {
  const { products } = useProducts();
  const { warehouses } = useWarehouses();

  const [form, setForm] = useState({
    productId: '',
    fromWarehouseId: '',
    toWarehouseId: '',
    quantity: '',
    note: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.productId || !form.fromWarehouseId || !form.toWarehouseId || !form.quantity) return;
    if (form.fromWarehouseId === form.toWarehouseId) {
      setError('Source and destination warehouse must be different.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      await transferStock(form.productId, form.fromWarehouseId, form.toWarehouseId, form.quantity, {
        note: form.note,
      });
      setForm({ productId: '', fromWarehouseId: '', toWarehouseId: '', quantity: '', note: '' });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Transfer Stock</h1>
      </div>

      <div className="card form-card">
        <form id="transfer-form" onSubmit={handleSubmit} className="form-grid">
          <div className="form-row">
            <label className="label" htmlFor="tr-product">Product</label>
            <select
              id="tr-product"
              className="select"
              value={form.productId}
              onChange={(e) => set('productId', e.target.value)}
              required
            >
              <option value="">— Select product —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label className="label" htmlFor="tr-from">From Warehouse</label>
            <select
              id="tr-from"
              className="select"
              value={form.fromWarehouseId}
              onChange={(e) => set('fromWarehouseId', e.target.value)}
              required
            >
              <option value="">— Select source —</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label className="label" htmlFor="tr-to">To Warehouse</label>
            <select
              id="tr-to"
              className="select"
              value={form.toWarehouseId}
              onChange={(e) => set('toWarehouseId', e.target.value)}
              required
            >
              <option value="">— Select destination —</option>
              {warehouses
                .filter((w) => w.id !== form.fromWarehouseId)
                .map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
            </select>
          </div>

          <div className="form-row">
            <label className="label" htmlFor="tr-quantity">Quantity</label>
            <input
              id="tr-quantity"
              type="number"
              className="input"
              value={form.quantity}
              onChange={(e) => set('quantity', e.target.value)}
              min="1"
              required
            />
          </div>

          <div className="form-row">
            <label className="label" htmlFor="tr-note">Note <span className="optional">(optional)</span></label>
            <input
              id="tr-note"
              type="text"
              className="input"
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
            />
          </div>

          {error && <p className="error-text">{error}</p>}
          {success && <p className="success-text">✓ Transfer recorded.</p>}

          <button
            id="transfer-submit-btn"
            type="submit"
            className={`btn btn-primary btn-full${submitting ? ' loading' : ''}`}
            disabled={submitting}
          >
            {submitting ? 'Saving…' : 'Record Transfer'}
          </button>
        </form>
      </div>
    </div>
  );
}
