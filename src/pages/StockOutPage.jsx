import { useState } from 'react';
import { useProducts } from '../hooks/useProducts';
import { useWarehouses } from '../hooks/useWarehouses';
import { stockOut } from '../lib/firestore';

export default function StockOutPage() {
  const { products } = useProducts();
  const { warehouses } = useWarehouses();

  const [form, setForm] = useState({ productId: '', warehouseId: '', quantity: '', note: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.productId || !form.warehouseId || !form.quantity) return;
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      await stockOut(form.productId, form.warehouseId, form.quantity, { note: form.note });
      setForm({ productId: '', warehouseId: '', quantity: '', note: '' });
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
        <h1 className="page-title">Stock Out</h1>
      </div>

      <div className="card form-card">
        <form id="stock-out-form" onSubmit={handleSubmit} className="form-grid">
          <div className="form-row">
            <label className="label" htmlFor="so-product">Product</label>
            <select
              id="so-product"
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
            <label className="label" htmlFor="so-warehouse">Warehouse</label>
            <select
              id="so-warehouse"
              className="select"
              value={form.warehouseId}
              onChange={(e) => set('warehouseId', e.target.value)}
              required
            >
              <option value="">— Select warehouse —</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label className="label" htmlFor="so-quantity">Quantity</label>
            <input
              id="so-quantity"
              type="number"
              className="input"
              value={form.quantity}
              onChange={(e) => set('quantity', e.target.value)}
              min="1"
              required
            />
          </div>

          <div className="form-row">
            <label className="label" htmlFor="so-note">Note <span className="optional">(optional)</span></label>
            <input
              id="so-note"
              type="text"
              className="input"
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
              placeholder="e.g. customer name, order #"
            />
          </div>

          {error && <p className="error-text">{error}</p>}
          {success && <p className="success-text">✓ Stock out recorded.</p>}

          <button
            id="stock-out-submit-btn"
            type="submit"
            className={`btn btn-danger btn-full${submitting ? ' loading' : ''}`}
            disabled={submitting}
          >
            {submitting ? 'Saving…' : 'Record Stock Out'}
          </button>
        </form>
      </div>
    </div>
  );
}
