# Stock Ledger

A production-quality PWA inventory tracker for a wholesale warehouse business.  
Built with **React 18 + Vite**, **Firebase** (Firestore + Auth + Hosting), and **Google Drive** backup.

---

## Prerequisites

- Node.js 18+ and npm
- [Firebase CLI](https://firebase.google.com/docs/cli): `npm install -g firebase-tools`
- A Google account

---

## Step 1 — Create a Firebase Project (free Spark plan)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and click **Add project**.
2. Give it a name (e.g. `stock-ledger`). Disable Google Analytics (not needed).
3. In the left sidebar:
   - **Build → Firestore Database** → Create database → **Start in production mode** → choose a region.
   - **Build → Authentication** → Get started → Sign-in method → **Email/Password** → Enable.

---

## Step 2 — Create the shared staff Auth account

> **This is the "PIN" system.** There is exactly **one** Firebase Auth user. Staff enter the password (PIN) at login; the app calls `signInWithEmailAndPassword` with that credential. The PIN is **never hardcoded** in the app source — only entered here in the Firebase Console.

1. In Firebase Console → **Authentication → Users → Add user**.
2. Email: `staff@yourbusiness.internal` (or any email — just remember it for your `.env`).
3. Password: choose a strong PIN that staff will memorize (e.g. `warehouse2024`).
4. Copy the email — you'll put it in `.env` as `VITE_AUTH_EMAIL`.

> ⚠️ **Never commit the password to source control.** It lives only in Firebase and in staff's memory.

---

## Step 3 — Get Firebase config and fill in `.env`

1. Firebase Console → **Project Settings (gear icon) → General → Your apps → Add app → Web**.
2. Register the app (no Firebase Hosting needed here yet).
3. Copy the `firebaseConfig` object values into your `.env` file:

```bash
cp .env.example .env
```

Then edit `.env`:

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123

VITE_AUTH_EMAIL=staff@yourbusiness.internal
VITE_GOOGLE_OAUTH_CLIENT_ID=  # fill in Step 5
```

---

## Step 4 — Deploy Firestore Security Rules

Update `.firebaserc` with your project ID:

```json
{
  "projects": {
    "default": "your-project-id"
  }
}
```

Then log in and deploy rules:

```bash
firebase login
firebase deploy --only firestore:rules
```

---

## Step 5 — Create the Firestore Composite Index

The Monthly Summary query requires a composite index on `transactions`:

1. Firebase Console → **Firestore → Indexes → Composite → Add index**.
2. Collection: `transactions`
3. Fields:
   - `type` — Ascending
   - `deleted` — Ascending
   - `createdAt` — Descending

> Alternatively, run the app once and click the link in the browser console error — Firebase will offer to create the index automatically.

---

## Step 6 — Set up Google OAuth for Drive Backup

1. Go to [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials).
2. Select the same Google project linked to Firebase (or create a new one and enable the **Google Drive API**).
3. **Enable the Drive API**: APIs & Services → Enable APIs → search "Google Drive API" → Enable.
4. **Create credentials**: Credentials → Create Credentials → **OAuth 2.0 Client ID**.
   - Application type: **Web application**
   - Authorized JavaScript origins:
     - `http://localhost:5173` (for development)
     - `https://your-project-id.web.app` (for production — add after deploying)
5. Copy the **Client ID** into `.env`:

```env
VITE_GOOGLE_OAUTH_CLIENT_ID=123456789-abc.apps.googleusercontent.com
```

> The backup uses `drive.file` scope — the minimal permission. It can only access files it creates itself.

---

## Step 7 — Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Enter the PIN to sign in.

---

## Step 8 — Deploy to Firebase Hosting

```bash
npm run build
firebase deploy
```

This deploys both hosting (the built React app) and Firestore rules.  
Your app will be live at `https://your-project-id.web.app`.

After deploying, **add your production URL** to the OAuth client's authorized origins (Step 6).

---

## Database Structure

The app uses **Cloud Firestore** (NoSQL document database). All collections require an authenticated session to read or write (`request.auth != null`).

---

### `warehouses/{id}`

Represents a physical storage location.

| Field | Type | Notes |
|-------|------|-------|
| `name` | `string` | Display name of the warehouse (trimmed) |
| `createdAt` | `Timestamp` | Server-set creation time |

> **Deletion rule (app layer):** A warehouse can only be deleted if every `stockLevels` document linked to it has `quantity === 0`. The check runs in `deleteWarehouse()` before touching Firestore.

---

### `products/{id}`

A product catalogue entry. `totalQuantity` is a denormalised sum across all warehouses for fast dashboard reads.

| Field | Type | Notes |
|-------|------|-------|
| `name` | `string` | Product display name (trimmed) |
| `category` | `string` | Optional category label (trimmed, may be `""`) |
| `lowStockThreshold` | `number` | Quantity below which a low-stock alert is shown |
| `totalQuantity` | `integer ≥ 0` | Aggregate stock across all warehouses — **rule-enforced non-negative** |
| `createdAt` | `Timestamp` | Server-set creation time |

> **Rule constraint:** Firestore rules reject any write that sets `totalQuantity` to a non-integer or a negative value.

---

### `stockLevels/{productId}_{warehouseId}`

Per-warehouse stock level. The document ID is the composite key `{productId}_{warehouseId}` — no auto-generated ID.

| Field | Type | Notes |
|-------|------|-------|
| `productId` | `string` | Reference to `products/{id}` |
| `warehouseId` | `string` | Reference to `warehouses/{id}` |
| `quantity` | `integer ≥ 0` | Current stock at this warehouse — **rule-enforced non-negative** |

> **Rule constraint:** Firestore rules reject any write that sets `quantity` to a non-integer or a negative value. There is no hard-delete rule — documents persist with `quantity: 0` after stock is fully removed.

---

### `transactions/{id}`

Immutable audit-trail entry for every stock movement. **Hard deletes are blocked by Firestore rules** — only soft-deletes are allowed.

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `productId` | `string` | No | Reference to `products/{id}` |
| `productName` | `string` | No | Snapshot of product name at write time |
| `type` | `"in" \| "out" \| "transfer"` | No | Movement direction |
| `quantity` | `integer > 0` | No | Units moved |
| `warehouseId` | `string` | No | Source warehouse (or only warehouse for in/out) |
| `toWarehouseId` | `string` | Yes | Destination warehouse — only set for `type: "transfer"`, `null` otherwise |
| `totalPrice` | `number` | Yes | Optional total purchase price — only meaningful for `type: "in"` |
| `totalWeight` | `number` | Yes | Optional total weight — only meaningful for `type: "in"` |
| `note` | `string` | Yes | Free-text note (trimmed), `null` if omitted |
| `createdAt` | `Timestamp` | No | Server-set creation time |
| `editedAt` | `Timestamp` | Yes | Server-set time of last edit or soft-delete; `null` on creation |
| `deleted` | `boolean` | No | `false` on creation; set to `true` on soft-delete |

> **Rule constraint:** A direct `update` to a transaction document may only touch `deleted` and `editedAt`. Any quantity or warehouse correction must go through `editTransaction()` / `deleteTransaction()`, which atomically fix `stockLevels` and `products.totalQuantity` in the same Firestore transaction.

**Transaction type behaviour summary:**

| `type` | Stock effect | `toWarehouseId` | Price/Weight |
|--------|-------------|-----------------|--------------|
| `in` | `stockLevels[wh] += qty`, `product.totalQuantity += qty` | `null` | Optional |
| `out` | `stockLevels[wh] -= qty`, `product.totalQuantity -= qty` | `null` | Always `null` |
| `transfer` | `stockLevels[from] -= qty`, `stockLevels[to] += qty` | Set | Always `null` |

---

### `meta/backup` (singleton)

Single document tracking the last Google Drive backup.

| Field | Type | Notes |
|-------|------|-------|
| `lastBackupAt` | `Timestamp` | Server-set time of the last successful backup |
| `lastBackupBy` | `string` | Email address of the authenticated user who ran the backup |

---

### Relationships

```
warehouses ──────────────────────────────────────────────────────┐
    │ id                                                          │
    │                                                             │
    │              stockLevels                                    │
    │              {productId}_{warehouseId}                      │
    │              ├── productId  ──────────────── products       │
    └──────────────┤── warehouseId                    │ id        │
                   └── quantity                       │           │
                                                      │           │
                   transactions                       │           │
                   ├── productId ────────────────────-┘           │
                   ├── warehouseId ──────────────────────────────-┘
                   └── toWarehouseId (nullable) ─────────── warehouses
```

### Required Composite Index

The Monthly Summary query requires a composite index on `transactions`:

| Collection | Field | Order |
|------------|-------|-------|
| `transactions` | `type` | Ascending |
| `transactions` | `deleted` | Ascending |
| `transactions` | `createdAt` | Descending |

See [Step 5](#step-5--create-the-firestore-composite-index) for setup instructions.

## Security Notes

- All Firestore reads/writes require an authenticated session (`request.auth != null`).
- `stockLevels` and `products.totalQuantity` are rule-enforced to never go negative.
- Transaction documents can only have `deleted` and `editedAt` updated directly — all other changes (quantity corrections) go through atomic Firestore transactions that also fix the stock levels.
- Warehouse deletion is blocked at the application layer (before calling Firestore) if any `stockLevels` document has `quantity > 0`.

## Features

| # | Feature |
|---|---------|
| 1 | Shared PIN login (real Firebase Auth session) |
| 2 | Warehouse management (add, rename, delete with stock guard) |
| 3 | Products with low-stock threshold |
| 4 | Stock In (with optional price, weight, note) |
| 5 | Stock Out (fails atomically if insufficient stock) |
| 6 | Warehouse-to-warehouse transfer |
| 7 | Dashboard — Total view + By-Warehouse view |
| 8 | Paginated transaction history (25/page) |
| 9 | Edit or soft-delete past transactions (atomic stock reversal) |
| 10 | Monthly stock-out summary by product |
| 11 | One-tap Google Drive backup |
