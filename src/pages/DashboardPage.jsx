import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProducts } from '../hooks/useProducts';
import { useWarehouses } from '../hooks/useWarehouses';
import { useStockLevels } from '../hooks/useStockLevels';
import LowStockBadge from '../components/LowStockBadge';
import BackupButton from '../components/BackupButton';

export default function DashboardPage() {
  const [view, setView] = useState('total'); // 'total' | 'warehouse'
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [search, setSearch] = useState('');

  const { products, loading: productsLoading } = useProducts();
  const { warehouses, loading: warehousesLoading } = useWarehouses();
  const { stockLevels } = useStockLevels(
    view === 'warehouse' ? selectedWarehouse || null : null
  );

  // Build a map for warehouse view: productId → quantity
  const stockMap = {};
  stockLevels.forEach((sl) => {
    stockMap[sl.productId] = sl.quantity;
  });

  const lowCountTotal = products.filter((p) => p.totalQuantity <= p.lowStockThreshold).length;

  // Filter by search term (case-insensitive substring on name)
  const term = search.trim().toLowerCase();
  const filtered = term
    ? products.filter((p) => p.name.toLowerCase().includes(term))
    : products;

  // Group filtered products by category, alphabetically
  const grouped = filtered.reduce((acc, p) => {
    const cat = p.category?.trim() || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});
  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    // Keep 'Uncategorized' last
    if (a === 'Uncategorized') return 1;
    if (b === 'Uncategorized') return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          {view === 'total' && lowCountTotal > 0 && (
            <p className="low-stock-alert">⚠ {lowCountTotal} product{lowCountTotal > 1 ? 's' : ''} low on stock</p>
          )}
        </div>
        <BackupButton />
      </div>

      <div className="dashboard-toolbar">
        <div className="view-toggle">
          <button
            id="total-view-btn"
            className={`toggle-btn${view === 'total' ? ' active' : ''}`}
            onClick={() => setView('total')}
          >
            Total Stock
          </button>
          <button
            id="warehouse-view-btn"
            className={`toggle-btn${view === 'warehouse' ? ' active' : ''}`}
            onClick={() => setView('warehouse')}
          >
            By Warehouse
          </button>
        </div>

        <input
          id="dashboard-search"
          type="search"
          className="input dashboard-search"
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <Link to="/products/new" className="btn btn-primary btn-sm">
          + New Product
        </Link>
      </div>

      {view === 'warehouse' && (
        <div className="warehouse-picker">
          <select
            id="dashboard-warehouse-select"
            className="select"
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
          >
            <option value="">— Select a warehouse —</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
      )}

      {(productsLoading || warehousesLoading) ? (
        <div className="loading-spinner">Loading…</div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th className="text-right">
                  {view === 'total' ? 'Total Quantity' : 'Quantity (this warehouse)'}
                </th>
                <th>Threshold</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-cell">
                    No products yet.{' '}
                    <Link to="/products/new" className="link">Add your first product →</Link>
                  </td>
                </tr>
              )}
              {filtered.length === 0 && products.length > 0 && (
                <tr>
                  <td colSpan={4} className="empty-cell">No products match "{search}".</td>
                </tr>
              )}
              {sortedCategories.map((cat) => (
                <>
                  <tr key={`cat-${cat}`} className="category-row">
                    <td colSpan={4} className="category-heading">{cat}</td>
                  </tr>
                  {grouped[cat].map((p) => {
                    const qty = view === 'total' ? p.totalQuantity : (stockMap[p.id] ?? 0);
                    const isLow = qty <= p.lowStockThreshold;
                    return (
                      <tr key={p.id} className={isLow ? 'row-low' : ''}>
                        <td className="product-name">{p.name}</td>
                        <td className="text-right qty-cell">{qty}</td>
                        <td className="text-right threshold-cell">{p.lowStockThreshold}</td>
                        <td>{isLow ? <LowStockBadge /> : <span className="badge badge-ok">OK</span>}</td>
                      </tr>
                    );
                  })}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
