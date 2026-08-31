import { useEffect, useState } from 'react';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { backupToDrive } from '../lib/drive';

export default function BackupButton() {
  const [backupMeta, setBackupMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'meta', 'backup'), (snap) => {
      setBackupMeta(snap.exists() ? snap.data() : null);
    });
    return unsub;
  }, []);

  async function handleBackup() {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      await backupToDrive();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(ts) {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString();
  }

  return (
    <div className="backup-widget">
      <button
        id="backup-btn"
        className={`btn btn-accent${loading ? ' loading' : ''}`}
        onClick={handleBackup}
        disabled={loading}
      >
        {loading ? 'Uploading…' : '☁ Backup to Drive'}
      </button>
      {backupMeta && (
        <p className="backup-meta">
          Last backup: <strong>{formatDate(backupMeta.lastBackupAt)}</strong>
          {backupMeta.lastBackupBy ? ` by ${backupMeta.lastBackupBy}` : ''}
        </p>
      )}
      {!backupMeta && <p className="backup-meta">No backups yet.</p>}
      {success && <p className="backup-success">✓ Backup uploaded successfully.</p>}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
