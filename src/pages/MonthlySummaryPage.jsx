import { useState } from 'react';
import { useMonthlyOutSummary } from '../hooks/useTransactions';

export default function MonthlySummaryPage() {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [monthValue, setMonthValue] = useState(defaultMonth);

  const [year, month] = monthValue ? monthValue.split('-').map(Number) : [null, null];
  const { rows, loading, error } = useMonthlyOutSummary(year, month);

  const totalOut = rows.reduce((sum, r) => sum + r.quantity, 0);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Monthly Stock-Out Summary</h1>
      </div>

      <div className="card form-card">
        <div className="form-row">
          <label className="label" htmlFor="month-picker">Month</label>
          <input
            id="month-picker"
            type="month"
            className="input"
            value={monthValue}
            onChange={(e) => setMonthValue(e.target.value)}
          />
        </div>
      </div>

      {loading && <div className="loading-spinner">Loading…</div>}
      {error && <p className="error-text">{error.message}</p>}

      {!loading && !error && (
        <div className="table-wrapper">
          <div className="summary-header">
            <span className="summary-period">
              {new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
            </span>
            <span className="summary-total">
              Total units out: <strong>{totalOut}</strong>
            </span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th className="text-right">Units Out</th>
                <th className="text-right">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={4} className="empty-cell">No stock-out records for this month.</td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={r.productId}>
                  <td className="rank-cell">{i + 1}</td>
                  <td className="product-name">{r.productName}</td>
                  <td className="text-right qty-cell">{r.quantity}</td>
                  <td className="text-right">
                    {totalOut > 0 ? `${((r.quantity / totalOut) * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
