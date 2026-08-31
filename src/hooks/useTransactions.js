import { useEffect, useState, useCallback } from 'react';
import { getDocs, onSnapshot } from 'firebase/firestore';
import { buildTransactionQuery, buildMonthlySummaryQuery } from '../lib/firestore';

const PAGE_SIZE = 25;

/**
 * Paginated transaction list hook for HistoryPage.
 * Returns transactions, a loadMore function, and a hasMore flag.
 */
export function useTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);

  // Load (or reload) the first page with a live listener
  useEffect(() => {
    setLoading(true);
    const q = buildTransactionQuery({}, PAGE_SIZE, null);
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTransactions(docs);
      setCursor(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.docs.length === PAGE_SIZE);
      setLoading(false);
    });
    return unsub;
  }, []);

  const loadMore = useCallback(async () => {
    if (!cursor || !hasMore) return;
    const q = buildTransactionQuery({}, PAGE_SIZE, cursor);
    const snap = await getDocs(q);
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setTransactions((prev) => [...prev, ...docs]);
    setCursor(snap.docs[snap.docs.length - 1] ?? null);
    setHasMore(snap.docs.length === PAGE_SIZE);
  }, [cursor, hasMore]);

  return { transactions, loading, hasMore, loadMore };
}

/**
 * Monthly summary hook — one-shot read, returns per-product totals for stock-out.
 */
export function useMonthlyOutSummary(year, month) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!year || !month) return;
    setLoading(true);
    setError(null);

    getDocs(buildMonthlySummaryQuery(year, month))
      .then((snap) => {
        const totals = {};
        snap.docs.forEach((d) => {
          const { productId, productName, quantity } = d.data();
          if (!totals[productId]) {
            totals[productId] = { productId, productName, quantity: 0 };
          }
          totals[productId].quantity += quantity;
        });
        const sorted = Object.values(totals).sort((a, b) => b.quantity - a.quantity);
        setRows(sorted);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [year, month]);

  return { rows, loading, error };
}
