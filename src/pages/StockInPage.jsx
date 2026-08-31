import { useState } from 'react';
import { useProducts } from '../hooks/useProducts';
import { useWarehouses } from '../hooks/useWarehouses';
import { stockIn, addProduct } from '../lib/firestore';

export default function StockInPage() {
  const { products } = useProducts();
  const { warehouses } = useWarehouses();

  const [form, setForm] = useState({
    productId: '',
    warehouseId: '',
    quantity: '',
    totalPrice: '',
    totalWeight: '',
    note: '',
  });
  const [newProductName, setNewProductName] = useState('');
  const [newProductThreshold, setNewProductThreshold] = useState('');
  const [showAddProduct, setShowAddProduct] = useState(false);
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
      await stockIn(form.productId, form.warehouseId, form.quantity, {
        totalPrice: form.totalPrice,
        totalWeight: form.totalWeight,
        note: form.note,
      });
      setForm({ productId: '', warehouseId: '', quantity: '', totalPrice: '', totalWeight: '', note: '' });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddProduct(e) {
    e.preventDefault();
    if (!newProductName.trim() || !newProductThreshold) return;
    try {
      await addProduct(newProductName, newProductThreshold);
      setNewProductName('');
      setNewProductThreshold('');
      setShowAddProduct(false);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Stock In</h1>
      </div>

      <div className="card form-card">
        <form id="stock-in-form" onSubmit={handleSubmit} className="form-grid">
          <div className="form-row">
            <label className="label" htmlFor="si-product">Product</label>
            <div className="input-with-action">
              <select
                id="si-product"
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
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowAddProduct((v) => !v)}
              >
                {showAddProduct ? 'Cancel' : '+ New Product'}
              </button>
            </div>
          </div>

          {showAddProduct && (
            <div className="inline-add-product card card-inset">
              <form onSubmit={handleAddProduct} className="inline-form">
                <input
                  className="input"
                  placeholder="Product name"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  required
                />
                <input
                  className="input"
                  type="number"
                  placeholder="Low stock threshold"
                  value={newProductThreshold}
                  onChange={(e) => setNewProductThreshold(e.target.value)}
                  min="0"
                  required
                />
                <button type="submit" className="btn btn-primary btn-sm">Add Product</button>
              </form>
            </div>
          )}

          <div className="form-row">
            <label className="label" htmlFor="si-warehouse">Warehouse</label>
            <select
              id="si-warehouse"
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
            <label className="label" htmlFor="si-quantity">Quantity</label>
            <input
              id="si-quantity"
              type="number"
              className="input"
              value={form.quantity}
              onChange={(e) => set('quantity', e.target.value)}
              min="1"
              required
            />
          </div>

          <div className="form-row">
            <label className="label" htmlFor="si-price">Total Price <span className="optional">(optional)</span></label>
            <input
              id="si-price"
              type="number"
              className="input"
              value={form.totalPrice}
              onChange={(e) => set('totalPrice', e.target.value)}
              min="0"
              step="0.01"
            />
          </div>

          <div className="form-row">
            <label className="label" htmlFor="si-weight">Total Weight (kg) <span className="optional">(optional)</span></label>
            <input
              id="si-weight"
              type="number"
              className="input"
              value={form.totalWeight}
              onChange={(e) => set('totalWeight', e.target.value)}
              min="0"
              step="0.01"
            />
          </div>

          <div className="form-row">
            <label className="label" htmlFor="si-note">Note <span className="optional">(optional)</span></label>
            <input
              id="si-note"
              type="text"
              className="input"
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
              placeholder="e.g. supplier name, batch #"
            />
          </div>

          {error && <p className="error-text">{error}</p>}
          {success && <p className="success-text">✓ Stock recorded successfully.</p>}

          <button
            id="stock-in-submit-btn"
            type="submit"
            className={`btn btn-primary btn-full${submitting ? ' loading' : ''}`}
            disabled={submitting}
          >
            {submitting ? 'Saving…' : 'Record Stock In'}
          </button>
        </form>
      </div>
    </div>
  );
}
