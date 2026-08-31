import { useState } from 'react';
import { useWarehouses } from '../hooks/useWarehouses';
import { addWarehouse, renameWarehouse, deleteWarehouse } from '../lib/firestore';

export default function WarehousesPage() {
  const { warehouses, loading } = useWarehouses();
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState(null);
  const [addSubmitting, setAddSubmitting] = useState(false);

  // Per-warehouse rename state
  const [renaming, setRenaming] = useState({}); // { id: boolean }
  const [renameValues, setRenameValues] = useState({}); // { id: string }
  const [renameErrors, setRenameErrors] = useState({});
  const [deleteErrors, setDeleteErrors] = useState({});

  async function handleAdd(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAddSubmitting(true);
    setAddError(null);
    try {
      await addWarehouse(newName);
      setNewName('');
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddSubmitting(false);
    }
  }

  function startRename(warehouse) {
    setRenaming((prev) => ({ ...prev, [warehouse.id]: true }));
    setRenameValues((prev) => ({ ...prev, [warehouse.id]: warehouse.name }));
    setRenameErrors((prev) => ({ ...prev, [warehouse.id]: null }));
  }

  async function handleRename(id) {
    const name = renameValues[id]?.trim();
    if (!name) return;
    try {
      await renameWarehouse(id, name);
      setRenaming((prev) => ({ ...prev, [id]: false }));
    } catch (err) {
      setRenameErrors((prev) => ({ ...prev, [id]: err.message }));
    }
  }

  async function handleDelete(id) {
    setDeleteErrors((prev) => ({ ...prev, [id]: null }));
    try {
      await deleteWarehouse(id);
    } catch (err) {
      setDeleteErrors((prev) => ({ ...prev, [id]: err.message }));
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Warehouses</h1>
      </div>

      <div className="card form-card">
        <h2 className="card-title">Add Warehouse</h2>
        <form id="add-warehouse-form" onSubmit={handleAdd} className="inline-form">
          <input
            id="new-warehouse-input"
            type="text"
            className="input"
            placeholder="Warehouse name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button
            id="add-warehouse-btn"
            type="submit"
            className="btn btn-primary"
            disabled={addSubmitting || !newName.trim()}
          >
            {addSubmitting ? 'Adding…' : 'Add'}
          </button>
        </form>
        {addError && <p className="error-text">{addError}</p>}
      </div>

      {loading ? (
        <div className="loading-spinner">Loading…</div>
      ) : (
        <div className="warehouse-list">
          {warehouses.length === 0 && (
            <p className="empty-message">No warehouses yet. Add one above.</p>
          )}
          {warehouses.map((w) => (
            <div key={w.id} className="warehouse-item card">
              {renaming[w.id] ? (
                <div className="rename-row">
                  <input
                    className="input"
                    value={renameValues[w.id] ?? w.name}
                    onChange={(e) =>
                      setRenameValues((prev) => ({ ...prev, [w.id]: e.target.value }))
                    }
                    autoFocus
                  />
                  <button className="btn btn-primary btn-sm" onClick={() => handleRename(w.id)}>
                    Save
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setRenaming((prev) => ({ ...prev, [w.id]: false }))}
                  >
                    Cancel
                  </button>
                  {renameErrors[w.id] && <p className="error-text">{renameErrors[w.id]}</p>}
                </div>
              ) : (
                <div className="warehouse-row">
                  <span className="warehouse-name">{w.name}</span>
                  <div className="warehouse-actions">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => startRename(w)}
                    >
                      Rename
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(w.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
              {deleteErrors[w.id] && (
                <p className="error-text error-indent">{deleteErrors[w.id]}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
