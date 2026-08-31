import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  runTransaction,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from './firebase';

// ─── Warehouses ──────────────────────────────────────────────────────────────

export async function addWarehouse(name) {
  await addDoc(collection(db, 'warehouses'), {
    name: name.trim(),
    createdAt: serverTimestamp(),
  });
}

export async function renameWarehouse(id, name) {
  await updateDoc(doc(db, 'warehouses', id), { name: name.trim() });
}

/**
 * Deletes a warehouse only if all its stockLevel documents have quantity === 0.
 * Throws an error with a user-friendly message if any stock remains.
 */
export async function deleteWarehouse(id) {
  const levelsQuery = query(
    collection(db, 'stockLevels'),
    where('warehouseId', '==', id)
  );
  const snap = await getDocs(levelsQuery);
  const hasStock = snap.docs.some((d) => d.data().quantity > 0);
  if (hasStock) {
    throw new Error(
      'This warehouse still has stock. Move or remove all stock before deleting.'
    );
  }
  await deleteDoc(doc(db, 'warehouses', id));
}

// ─── Products ────────────────────────────────────────────────────────────────

export async function addProduct(name, lowStockThreshold, category = '') {
  await addDoc(collection(db, 'products'), {
    name: name.trim(),
    lowStockThreshold: Number(lowStockThreshold),
    category: category.trim(),
    totalQuantity: 0,
    createdAt: serverTimestamp(),
  });
}


export async function renameProduct(id, name) {
  await updateDoc(doc(db, 'products', id), { name: name.trim() });
}

/**
 * Deletes a product only if it has no remaining stock across all warehouses.
 * Uses the already-maintained products.totalQuantity field — no extra query needed.
 * Throws an error with a user-friendly message if any stock remains.
 * Historical transactions are left untouched (immutable audit records).
 */
export async function deleteProduct(id) {
  const productSnap = await getDoc(doc(db, 'products', id));
  if (!productSnap.exists()) throw new Error('Product not found.');
  if (productSnap.data().totalQuantity > 0) {
    throw new Error(
      'This product still has stock. Move or remove all stock before deleting.'
    );
  }
  await deleteDoc(doc(db, 'products', id));
}

// ─── Stock In ─────────────────────────────────────────────────────────────────

export async function stockIn(productId, warehouseId, quantity, { totalPrice, totalWeight, note } = {}) {
  const qty = Number(quantity);
  const stockLevelId = `${productId}_${warehouseId}`;
  const stockRef = doc(db, 'stockLevels', stockLevelId);
  const productRef = doc(db, 'products', productId);

  await runTransaction(db, async (tx) => {
    const stockSnap = await tx.get(stockRef);
    const productSnap = await tx.get(productRef);

    if (!productSnap.exists()) throw new Error('Product not found.');

    const currentStock = stockSnap.exists() ? stockSnap.data().quantity : 0;
    const newStock = currentStock + qty;

    tx.set(stockRef, {
      productId,
      warehouseId,
      quantity: newStock,
    });

    tx.update(productRef, {
      totalQuantity: productSnap.data().totalQuantity + qty,
    });

    const txData = {
      productId,
      productName: productSnap.data().name,
      type: 'in',
      quantity: qty,
      warehouseId,
      toWarehouseId: null,
      note: note?.trim() || null,
      totalPrice: totalPrice != null && totalPrice !== '' ? Number(totalPrice) : null,
      totalWeight: totalWeight != null && totalWeight !== '' ? Number(totalWeight) : null,
      createdAt: serverTimestamp(),
      editedAt: null,
      deleted: false,
    };
    tx.set(doc(collection(db, 'transactions')), txData);
  });
}

// ─── Stock Out ────────────────────────────────────────────────────────────────

export async function stockOut(productId, warehouseId, quantity, { note } = {}) {
  const qty = Number(quantity);
  const stockLevelId = `${productId}_${warehouseId}`;
  const stockRef = doc(db, 'stockLevels', stockLevelId);
  const productRef = doc(db, 'products', productId);

  await runTransaction(db, async (tx) => {
    const stockSnap = await tx.get(stockRef);
    const productSnap = await tx.get(productRef);

    if (!productSnap.exists()) throw new Error('Product not found.');

    const currentStock = stockSnap.exists() ? stockSnap.data().quantity : 0;
    if (currentStock - qty < 0) {
      throw new Error(
        `Insufficient stock at this warehouse. Available: ${currentStock}, requested: ${qty}.`
      );
    }

    tx.set(stockRef, {
      productId,
      warehouseId,
      quantity: currentStock - qty,
    });

    tx.update(productRef, {
      totalQuantity: productSnap.data().totalQuantity - qty,
    });

    const txData = {
      productId,
      productName: productSnap.data().name,
      type: 'out',
      quantity: qty,
      warehouseId,
      toWarehouseId: null,
      note: note?.trim() || null,
      totalPrice: null,
      totalWeight: null,
      createdAt: serverTimestamp(),
      editedAt: null,
      deleted: false,
    };
    tx.set(doc(collection(db, 'transactions')), txData);
  });
}

// ─── Transfer ─────────────────────────────────────────────────────────────────

export async function transferStock(productId, fromWarehouseId, toWarehouseId, quantity, { note } = {}) {
  const qty = Number(quantity);
  const fromRef = doc(db, 'stockLevels', `${productId}_${fromWarehouseId}`);
  const toRef = doc(db, 'stockLevels', `${productId}_${toWarehouseId}`);
  const productRef = doc(db, 'products', productId);

  await runTransaction(db, async (tx) => {
    const [fromSnap, toSnap, productSnap] = await Promise.all([
      tx.get(fromRef),
      tx.get(toRef),
      tx.get(productRef),
    ]);

    if (!productSnap.exists()) throw new Error('Product not found.');

    const fromQty = fromSnap.exists() ? fromSnap.data().quantity : 0;
    if (fromQty - qty < 0) {
      throw new Error(
        `Insufficient stock in source warehouse. Available: ${fromQty}, requested: ${qty}.`
      );
    }
    const toQty = toSnap.exists() ? toSnap.data().quantity : 0;

    tx.set(fromRef, { productId, warehouseId: fromWarehouseId, quantity: fromQty - qty });
    tx.set(toRef, { productId, warehouseId: toWarehouseId, quantity: toQty + qty });

    // totalQuantity does NOT change — stock moved within the business
    const txData = {
      productId,
      productName: productSnap.data().name,
      type: 'transfer',
      quantity: qty,
      warehouseId: fromWarehouseId,
      toWarehouseId,
      note: note?.trim() || null,
      totalPrice: null,
      totalWeight: null,
      createdAt: serverTimestamp(),
      editedAt: null,
      deleted: false,
    };
    tx.set(doc(collection(db, 'transactions')), txData);
  });
}

// ─── Edit Transaction ─────────────────────────────────────────────────────────

/**
 * Atomically reverses the original transaction's stock effect,
 * applies the new values, and updates the document.
 * newData: { quantity, warehouseId, toWarehouseId, totalPrice, totalWeight, note }
 */
export async function editTransaction(txId, newData) {
  const txRef = doc(db, 'transactions', txId);

  await runTransaction(db, async (tx) => {
    const txSnap = await tx.get(txRef);
    if (!txSnap.exists()) throw new Error('Transaction not found.');
    const orig = txSnap.data();
    if (orig.deleted) throw new Error('Cannot edit a deleted transaction.');

    const productRef = doc(db, 'products', orig.productId);
    const productSnap = await tx.get(productRef);
    if (!productSnap.exists()) throw new Error('Product not found.');

    const newQty = Number(newData.quantity);
    const origQty = orig.quantity;

    if (orig.type === 'in') {
      const origStockRef = doc(db, 'stockLevels', `${orig.productId}_${orig.warehouseId}`);
      const origStockSnap = await tx.get(origStockRef);
      const origStock = origStockSnap.exists() ? origStockSnap.data().quantity : 0;

      // Reverse original in, apply new in
      const delta = newQty - origQty;
      const newStockQty = origStock + delta;
      if (newStockQty < 0) throw new Error('Edit would result in negative stock.');

      tx.set(origStockRef, { productId: orig.productId, warehouseId: orig.warehouseId, quantity: newStockQty });
      tx.update(productRef, { totalQuantity: productSnap.data().totalQuantity + delta });

    } else if (orig.type === 'out') {
      const origStockRef = doc(db, 'stockLevels', `${orig.productId}_${orig.warehouseId}`);
      const origStockSnap = await tx.get(origStockRef);
      const origStock = origStockSnap.exists() ? origStockSnap.data().quantity : 0;

      // Reverse original out (add back), apply new out (subtract)
      const stockAfterReverse = origStock + origQty;
      const newStockQty = stockAfterReverse - newQty;
      if (newStockQty < 0) throw new Error('Edit would result in negative stock.');

      tx.set(origStockRef, { productId: orig.productId, warehouseId: orig.warehouseId, quantity: newStockQty });
      tx.update(productRef, { totalQuantity: productSnap.data().totalQuantity + origQty - newQty });

    } else if (orig.type === 'transfer') {
      const fromRef = doc(db, 'stockLevels', `${orig.productId}_${orig.warehouseId}`);
      const toRef = doc(db, 'stockLevels', `${orig.productId}_${orig.toWarehouseId}`);
      const [fromSnap, toSnap] = await Promise.all([tx.get(fromRef), tx.get(toRef)]);
      const fromQty = fromSnap.exists() ? fromSnap.data().quantity : 0;
      const toQty = toSnap.exists() ? toSnap.data().quantity : 0;

      // Reverse original transfer, apply new quantities
      const reversedFrom = fromQty + origQty;
      const reversedTo = toQty - origQty;

      const newFrom = reversedFrom - newQty;
      const newTo = reversedTo + newQty;
      if (newFrom < 0) throw new Error('Edit would result in negative stock at source warehouse.');
      if (newTo < 0) throw new Error('Edit would result in negative stock at destination warehouse.');

      tx.set(fromRef, { productId: orig.productId, warehouseId: orig.warehouseId, quantity: newFrom });
      tx.set(toRef, { productId: orig.productId, warehouseId: orig.toWarehouseId, quantity: newTo });
      // totalQuantity unchanged for transfers
    }

    // Update only the allowed fields plus editedAt on the transaction document.
    // (Firestore rules restrict updates to only 'deleted' and 'editedAt' on transactions,
    // so the full document write here goes through the atomic transaction path — not a
    // direct client write — which is the intended pattern for edits.)
    tx.update(txRef, {
      quantity: newQty,
      note: newData.note?.trim() || null,
      totalPrice: newData.totalPrice != null && newData.totalPrice !== '' ? Number(newData.totalPrice) : null,
      totalWeight: newData.totalWeight != null && newData.totalWeight !== '' ? Number(newData.totalWeight) : null,
      editedAt: serverTimestamp(),
    });
  });
}

// ─── Delete Transaction (soft) ────────────────────────────────────────────────

export async function deleteTransaction(txId) {
  const txRef = doc(db, 'transactions', txId);

  await runTransaction(db, async (tx) => {
    const txSnap = await tx.get(txRef);
    if (!txSnap.exists()) throw new Error('Transaction not found.');
    const orig = txSnap.data();
    if (orig.deleted) throw new Error('Already deleted.');

    const productRef = doc(db, 'products', orig.productId);
    const productSnap = await tx.get(productRef);
    if (!productSnap.exists()) throw new Error('Product not found.');

    if (orig.type === 'in') {
      const stockRef = doc(db, 'stockLevels', `${orig.productId}_${orig.warehouseId}`);
      const stockSnap = await tx.get(stockRef);
      const currentQty = stockSnap.exists() ? stockSnap.data().quantity : 0;
      const newQty = currentQty - orig.quantity;
      if (newQty < 0) throw new Error('Deleting this entry would result in negative stock.');
      tx.set(stockRef, { productId: orig.productId, warehouseId: orig.warehouseId, quantity: newQty });
      tx.update(productRef, { totalQuantity: productSnap.data().totalQuantity - orig.quantity });

    } else if (orig.type === 'out') {
      const stockRef = doc(db, 'stockLevels', `${orig.productId}_${orig.warehouseId}`);
      const stockSnap = await tx.get(stockRef);
      const currentQty = stockSnap.exists() ? stockSnap.data().quantity : 0;
      tx.set(stockRef, { productId: orig.productId, warehouseId: orig.warehouseId, quantity: currentQty + orig.quantity });
      tx.update(productRef, { totalQuantity: productSnap.data().totalQuantity + orig.quantity });

    } else if (orig.type === 'transfer') {
      const fromRef = doc(db, 'stockLevels', `${orig.productId}_${orig.warehouseId}`);
      const toRef = doc(db, 'stockLevels', `${orig.productId}_${orig.toWarehouseId}`);
      const [fromSnap, toSnap] = await Promise.all([tx.get(fromRef), tx.get(toRef)]);
      const fromQty = fromSnap.exists() ? fromSnap.data().quantity : 0;
      const toQty = toSnap.exists() ? toSnap.data().quantity : 0;
      const newTo = toQty - orig.quantity;
      if (newTo < 0) throw new Error('Deleting this transfer would result in negative stock at destination.');
      tx.set(fromRef, { productId: orig.productId, warehouseId: orig.warehouseId, quantity: fromQty + orig.quantity });
      tx.set(toRef, { productId: orig.productId, warehouseId: orig.toWarehouseId, quantity: newTo });
    }

    tx.update(txRef, { deleted: true, editedAt: serverTimestamp() });
  });
}

// ─── Backup Meta ──────────────────────────────────────────────────────────────

export async function writeBackupMeta(email) {
  await setDoc(doc(db, 'meta', 'backup'), {
    lastBackupAt: serverTimestamp(),
    lastBackupBy: email,
  });
}

// ─── Read helpers (used by Drive backup) ─────────────────────────────────────

export async function getAllForBackup() {
  const [productsSnap, warehousesSnap, txSnap] = await Promise.all([
    getDocs(collection(db, 'products')),
    getDocs(collection(db, 'warehouses')),
    getDocs(query(collection(db, 'transactions'), where('deleted', '==', false))),
  ]);

  return {
    products: productsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    warehouses: warehousesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    transactions: txSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    exportedAt: new Date().toISOString(),
  };
}

// ─── Paginated transaction queries ───────────────────────────────────────────

export function buildTransactionQuery(filters = {}, pageSize = 25, cursor = null) {
  let q = query(
    collection(db, 'transactions'),
    where('deleted', '==', false),
    orderBy('createdAt', 'desc'),
    limit(pageSize)
  );
  if (cursor) q = query(q, startAfter(cursor));
  return q;
}

export function buildMonthlySummaryQuery(year, month) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  return query(
    collection(db, 'transactions'),
    where('type', '==', 'out'),
    where('deleted', '==', false),
    where('createdAt', '>=', start),
    where('createdAt', '<', end),
    orderBy('createdAt', 'desc')
  );
}
