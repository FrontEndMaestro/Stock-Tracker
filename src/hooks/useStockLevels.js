import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * @param {string|null} warehouseId - if provided, filters to that warehouse only
 */
export function useStockLevels(warehouseId = null) {
  const [stockLevels, setStockLevels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let q;
    if (warehouseId) {
      q = query(collection(db, 'stockLevels'), where('warehouseId', '==', warehouseId));
    } else {
      q = query(collection(db, 'stockLevels'));
    }

    const unsub = onSnapshot(q, (snap) => {
      setStockLevels(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [warehouseId]);

  return { stockLevels, loading };
}
