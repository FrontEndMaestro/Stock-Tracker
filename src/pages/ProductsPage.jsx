import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProducts } from '../hooks/useProducts';
import { renameProduct, deleteProduct } from '../lib/firestore';

export default function ProductsPage() {
  const { products, loading } = useProducts();

  // Per-product rename state
  const [renaming, setRenaming] = useState({});       // { id: boolean }
  const [renameValues, setRenameValues] = useState({}); // { id: string }
  const [renameErrors, setRenameErrors] = useState({});

  // Per-product delete state
  const [confirming, setConfirming] = useState({}); // { id: boolean }
  const [deleteErrors, setDeleteErrors] = useState({});

  function startRename(product) {
    setRenaming((prev) => ({ ...prev, [product.id]: true }));
    setRenameValues((prev) => ({ ...prev, [product.id]: product.name }));
    setRenameErrors((prev) => ({ ...prev, [product.id]: null }));
  }

  async function handleRename(id) {
    const name = renameValues[id]?.trim();
    if (!name) return;
    try {
      await renameProduct(id, name);
      setRenaming((prev) => ({ ...prev, [id]: false }));
    } catch (err) {
      setRenameErrors((prev) => ({ ...prev, [id]: err.message }));
    }
  }

  async function handleDelete(id) {
    setDeleteErrors((prev) => ({ ...prev, [id]: null }));
    try {
      await deleteProduct(id);
      setConfirming((prev) => ({ ...prev, [id]: false }));
    } catch (err) {
      setDeleteErrors((prev) => ({ ...prev, [id]: err.message }));
      setConfirming((prev) => ({ ...prev, [id]: false }));
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Products</h1>
        <Link to="/products/new" className="btn btn-primary btn-sm">
          + New product
        </Link>
      </div>

      {loading ? (
        <div className="loading-spinner">Loading…</div>
      ) : (
        <div className="warehouse-list">
          {products.length === 0 && (
            <p className="empty-message">No products yet. Add one above.</p>
          )}
          {products.map((p) => (
            <div key={p.id} className="warehouse-item card">
              {renaming[p.id] ? (
                <div className="rename-row">
                  <input
                    className="input"
                    value={renameValues[p.id] ?? p.name}
                    onChange={(e) =>
                      setRenameValues((prev) => ({ ...prev, [p.id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(p.id);
                      if (e.key === 'Escape') setRenaming((prev) => ({ ...prev, [p.id]: false }));
                    }}
                    autoFocus
                  />
                  <button className="btn btn-primary btn-sm" onClick={() => handleRename(p.id)}>
                    Save
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setRenaming((prev) => ({ ...prev, [p.id]: false }))}
                  >
                    Cancel
                  </button>
                  {renameErrors[p.id] && <p className="error-text">{renameErrors[p.id]}</p>}
                </div>
              ) : (
                <div className="warehouse-row">
                  <div>
                    {/* Click the name to enter rename mode */}
                    <button
                      className="warehouse-name btn-reset"
                      title="Click to rename"
                      onClick={() => startRename(p)}
                      style={{ cursor: 'text', background: 'none', border: 'none', padding: 0, font: 'inherit', textAlign: 'left' }}
                    >
                      {p.name}
                    </button>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #888)', marginTop: '0.15rem' }}>
                      {p.category && <span style={{ marginRight: '0.75rem' }}>Category: {p.category}</span>}
                      <span style={{ marginRight: '0.75rem' }}>Threshold: {p.lowStockThreshold}</span>
                      <span>Stock: {p.totalQuantity}</span>
                    </div>
                  </div>
                  <div className="warehouse-actions">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => startRename(p)}
                    >
                      Rename
                    </button>
                    {confirming[p.id] ? (
                      <>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #888)' }}>Sure?</span>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(p.id)}
                        >
                          Yes, delete
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setConfirming((prev) => ({ ...prev, [p.id]: false }))}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => setConfirming((prev) => ({ ...prev, [p.id]: true }))}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )}
              {deleteErrors[p.id] && (
                <p className="error-text error-indent">{deleteErrors[p.id]}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
