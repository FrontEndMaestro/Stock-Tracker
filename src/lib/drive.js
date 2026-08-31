import { getAllForBackup, writeBackupMeta } from './firestore';

const DRIVE_API = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
const FOLDER_KEY = 'stockledger_backup_folder_id';

/**
 * Loads the GIS (Google Identity Services) script once, then requests
 * a short-lived OAuth access token for drive.file scope.
 */
function getAccessToken() {
  return new Promise((resolve, reject) => {
    const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;
    if (!clientId) {
      reject(new Error('Google OAuth client ID is not configured. Set VITE_GOOGLE_OAUTH_CLIENT_ID in .env'));
      return;
    }

    // Load GIS script if not already loaded
    const load = () => {
      window.google.accounts.oauth2
        .initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/drive.file',
          callback: (response) => {
            if (response.error) {
              reject(new Error(`OAuth error: ${response.error}`));
            } else {
              resolve(response.access_token);
            }
          },
        })
        .requestAccessToken();
    };

    if (window.google?.accounts?.oauth2) {
      load();
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = load;
      script.onerror = () => reject(new Error('Failed to load Google Identity Services.'));
      document.head.appendChild(script);
    }
  });
}

/**
 * Finds or creates the "Stock Ledger Backups" folder in the user's Drive.
 * Caches the folder ID in localStorage to avoid repeated API calls.
 */
async function getOrCreateFolder(token) {
  const cached = localStorage.getItem(FOLDER_KEY);
  if (cached) return cached;

  // Search for existing folder
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      "name='Stock Ledger Backups' and mimeType='application/vnd.google-apps.folder' and trashed=false"
    )}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const searchData = await searchRes.json();

  if (searchData.files?.length > 0) {
    const folderId = searchData.files[0].id;
    localStorage.setItem(FOLDER_KEY, folderId);
    return folderId;
  }

  // Create folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Stock Ledger Backups',
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  const folder = await createRes.json();
  localStorage.setItem(FOLDER_KEY, folder.id);
  return folder.id;
}

/**
 * Main export: gathers all data → uploads to Drive → writes backup meta.
 * Returns the email address of the Google account used.
 */
export async function backupToDrive() {
  const token = await getAccessToken();

  // Get the email of the authenticated Google account
  const profileRes = await fetch(
    'https://www.googleapis.com/oauth2/v3/userinfo',
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const profile = await profileRes.json();
  const email = profile.email || 'unknown';

  const folderId = await getOrCreateFolder(token);
  const data = await getAllForBackup();

  const filename = `stock-ledger-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });

  const metadata = JSON.stringify({
    name: filename,
    parents: [folderId],
  });

  const form = new FormData();
  form.append('metadata', new Blob([metadata], { type: 'application/json' }));
  form.append('file', blob);

  const uploadRes = await fetch(DRIVE_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.json();
    throw new Error(`Drive upload failed: ${err.error?.message || uploadRes.statusText}`);
  }

  await writeBackupMeta(email);
  return email;
}
