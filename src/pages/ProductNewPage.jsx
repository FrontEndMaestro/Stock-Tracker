import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProducts } from '../hooks/useProducts';
import { addProduct } from '../lib/firestore';

export default function ProductNewPage() {
  const navigate = useNavigate();
  const { products } = useProducts();

  const [form, setForm] = useState({ name: '', lowStockThreshold: '', category: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Distinct categories from existing products for datalist suggestions
  const existingCategories = [...new Set(
    products.map((p) => p.category?.trim()).filter(Boolean)
  )].sort();

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.lowStockThreshold) return;
    setSubmitting(true);
    setError(null);
    try {
      await addProduct(form.name, form.lowStockThreshold, form.category);
      navigate('/');
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Add Product</h1>
      </div>

      <div className="card form-card">
        <form id="add-product-form" onSubmit={handleSubmit} className="form-grid">
          <div className="form-row">
            <label className="label" htmlFor="np-name">Name</label>
            <input
              id="np-name"
              type="text"
              className="input"
              placeholder="e.g. Basmati Rice 25kg"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="form-row">
            <label className="label" htmlFor="np-threshold">Low Stock Threshold</label>
            <input
              id="np-threshold"
              type="number"
              className="input"
              placeholder="e.g. 10"
              value={form.lowStockThreshold}
              onChange={(e) => set('lowStockThreshold', e.target.value)}
              min="0"
              required
            />
          </div>

          <div className="form-row">
            <label className="label" htmlFor="np-category">
              Category <span className="optional">(optional)</span>
            </label>
            <input
              id="np-category"
              type="text"
              className="input"
              placeholder="e.g. Rice, Daal, Oil"
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              list="category-suggestions"
            />
            <datalist id="category-suggestions">
              {existingCategories.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>

          {error && <p className="error-text">{error}</p>}

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => navigate('/')}
            >
              Cancel
            </button>
            <button
              id="add-product-submit-btn"
              type="submit"
              className={`btn btn-primary${submitting ? ' loading' : ''}`}
              disabled={submitting || !form.name.trim() || !form.lowStockThreshold}
            >
              {submitting ? 'Adding…' : 'Add Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
