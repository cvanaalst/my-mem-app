/*
 * Second Memory — Google Drive sync layer.
 *
 * OAuth: Google Identity Services token model (popup), scope
 * drive.file only (this app can only see files it created itself).
 *
 * iOS standalone pitfall: popup-based OAuth is unreliable in Home-Screen
 * PWAs on iOS. When running standalone, or when the popup flow fails,
 * this falls back to a full-page redirect using the OAuth 2.0 implicit
 * flow (response_type=token). That flow is secretless and works for a
 * public static-file client; the authorization-code+PKCE flow the spec
 * originally asked for is NOT usable here because Google's token
 * endpoint requires a client_secret for "Web application" OAuth clients
 * even with PKCE — that's only waived for installed-app client types,
 * which can't use a GitHub Pages redirect URI. See README for the
 * one-time Google Cloud setup this requires.
 *
 * Access tokens live ~1h. There is no silent refresh: sync is always an
 * explicit action (button, or auto-sync on launch) that gets a fresh
 * token when needed, never assuming a long session.
 */
import { db } from "./db.js";
import { mergeItemSets, computeMediaActions } from "./merge.js";

/* ============================== CONFIG ==================================
 * Paste your own OAuth Client ID here (Google Cloud Console → APIs &
 * Services → Credentials → OAuth client ID → type "Web application").
 * See README.md for the full step-by-step setup.
 * ======================================================================== */
const GOOGLE_CLIENT_ID = "159956462209-fejle37n0daaqpq756jaul629dh1i150.apps.googleusercontent.com";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
/* ======================================================================== */

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const RESUMABLE_THRESHOLD = 5 * 1024 * 1024; // Drive multipart cap
const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000;

let tokenClient = null;
let listeners = [];

function emitStatus(status) {
  listeners.forEach((fn) => fn(status));
}

/* --------------------------------------------------------------- token */

function isStandalone() {
  return window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
}

function redirectUri() {
  // Must exactly match an "Authorized redirect URI" in the Google Cloud
  // OAuth client config — see README. Strips any query/hash.
  return window.location.origin + window.location.pathname;
}

async function cacheToken(accessToken, expiresInSeconds) {
  const expiresAt = Date.now() + expiresInSeconds * 1000 - TOKEN_EXPIRY_BUFFER_MS;
  await db.setMeta("driveToken", { accessToken, expiresAt });
}

async function getCachedToken() {
  const cached = await db.getMeta("driveToken");
  if (cached && cached.expiresAt > Date.now()) return cached.accessToken;
  return null;
}

function ensureTokenClient() {
  if (tokenClient) return tokenClient;
  if (!window.google || !window.google.accounts) {
    throw new Error("Google Identity Services script not loaded (offline?)");
  }
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: DRIVE_SCOPE,
    callback: () => {}, // overridden per request below
  });
  return tokenClient;
}

function requestTokenViaPopup() {
  return new Promise((resolve, reject) => {
    const client = ensureTokenClient();
    client.callback = (resp) => {
      if (resp.error) { reject(new Error(resp.error)); return; }
      cacheToken(resp.access_token, resp.expires_in || 3600).then(() => resolve(resp.access_token));
    };
    client.error_callback = (err) => reject(new Error(err?.type || "popup_failed"));
    try {
      client.requestAccessToken({ prompt: "" });
    } catch (err) {
      reject(err);
    }
  });
}

function beginRedirectAuth(pendingAction) {
  sessionStorage.setItem("sm_pending_action", pendingAction || "sync");
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: "token",
    scope: DRIVE_SCOPE,
    include_granted_scopes: "true",
  });
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Call once on app startup, before anything else needs a token. If the
 * page was just reached via the redirect-auth fallback, this extracts
 * the access token from the URL fragment, caches it, cleans the URL, and
 * returns the pending action name (e.g. "sync") so the caller can resume
 * what the user was trying to do. Returns null if this wasn't a redirect return.
 */
export async function handleRedirectReturn() {
  if (!window.location.hash.includes("access_token")) return null;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const token = params.get("access_token");
  const expiresIn = parseInt(params.get("expires_in") || "3600", 10);
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  if (!token) return null;
  await cacheToken(token, expiresIn);
  const pending = sessionStorage.getItem("sm_pending_action");
  sessionStorage.removeItem("sm_pending_action");
  return pending;
}

/**
 * Get a usable access token. If forceInteractive is false and a cached
 * token is still valid, returns it immediately without any UI. Otherwise
 * triggers sign-in: popup flow normally, or the full-page redirect
 * fallback in standalone mode / when the popup fails. The redirect path
 * navigates away, so this promise will never resolve in that case — the
 * app reloads and handleRedirectReturn() picks up where it left off.
 */
export async function getAccessToken({ forceInteractive = false, pendingAction = "sync" } = {}) {
  if (!forceInteractive) {
    const cached = await getCachedToken();
    if (cached) return cached;
  }
  if (isStandalone()) {
    beginRedirectAuth(pendingAction);
    return new Promise(() => {});
  }
  try {
    return await requestTokenViaPopup();
  } catch (_err) {
    beginRedirectAuth(pendingAction);
    return new Promise(() => {});
  }
}

export async function isSignedIn() {
  return (await getCachedToken()) !== null;
}

/* ------------------------------------------------------------ Drive API */

async function driveFetch(url, options, token) {
  const res = await fetch(url, {
    ...options,
    headers: { ...(options?.headers || {}), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Drive ${res.status}: ${text.slice(0, 200)}`);
  }
  return res;
}

async function findFile(token, name, parentId) {
  const q = encodeURIComponent(`name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed=false`);
  const res = await driveFetch(`${DRIVE_API}/files?q=${q}&fields=files(id,name,modifiedTime)`, {}, token);
  const data = await res.json();
  return data.files && data.files[0] ? data.files[0] : null;
}

async function listFiles(token, parentId) {
  const q = encodeURIComponent(`'${parentId}' in parents and trashed=false`);
  const res = await driveFetch(`${DRIVE_API}/files?q=${q}&fields=files(id,name,modifiedTime)&pageSize=1000`, {}, token);
  const data = await res.json();
  return data.files || [];
}

async function ensureFolder(token, name, parentId) {
  const metaKey = parentId ? `driveFolder:${parentId}:${name}` : `driveFolder:root:${name}`;
  const cachedId = await db.getMeta(metaKey);
  if (cachedId) {
    try {
      await driveFetch(`${DRIVE_API}/files/${cachedId}?fields=id,trashed`, {}, token);
      return cachedId;
    } catch (_) { /* stale, fall through */ }
  }
  const q = parentId
    ? `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
    : `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await driveFetch(`${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id)`, {}, token);
  const data = await res.json();
  let id;
  if (data.files && data.files[0]) {
    id = data.files[0].id;
  } else {
    const body = { name, mimeType: "application/vnd.google-apps.folder" };
    if (parentId) body.parents = [parentId];
    const createRes = await driveFetch(`${DRIVE_API}/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }, token);
    id = (await createRes.json()).id;
  }
  await db.setMeta(metaKey, id);
  return id;
}

async function downloadJson(token, fileId) {
  const res = await driveFetch(`${DRIVE_API}/files/${fileId}?alt=media`, {}, token);
  return res.json();
}

async function downloadBlob(token, fileId) {
  const res = await driveFetch(`${DRIVE_API}/files/${fileId}?alt=media`, {}, token);
  return res.blob();
}

async function multipartUpload(token, { fileId, name, parents, body, mimeType }) {
  const boundary = "smbnd" + Math.random().toString(36).slice(2);
  const metadata = { name };
  if (parents) metadata.parents = parents;
  const metaPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
  const mediaHeader = `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const closing = `\r\n--${boundary}--`;
  const blobBody = new Blob([metaPart, mediaHeader, body, closing]);
  const url = fileId
    ? `${DRIVE_UPLOAD_API}/files/${fileId}?uploadType=multipart`
    : `${DRIVE_UPLOAD_API}/files?uploadType=multipart`;
  const res = await driveFetch(url, {
    method: fileId ? "PATCH" : "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body: blobBody,
  }, token);
  return res.json();
}

async function resumableUpload(token, { fileId, name, parents, body, mimeType }) {
  const initUrl = fileId
    ? `${DRIVE_UPLOAD_API}/files/${fileId}?uploadType=resumable`
    : `${DRIVE_UPLOAD_API}/files?uploadType=resumable`;
  const metadata = { name };
  if (parents) metadata.parents = parents;
  const initRes = await driveFetch(initUrl, {
    method: fileId ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": mimeType },
    body: JSON.stringify(metadata),
  }, token);
  const sessionUrl = initRes.headers.get("Location");
  const putRes = await fetch(sessionUrl, { method: "PUT", headers: { "Content-Type": mimeType }, body });
  if (!putRes.ok) throw new Error(`Resumable upload failed: ${putRes.status}`);
  return putRes.json();
}

async function uploadBlob(token, args) {
  const size = args.body.size ?? new Blob([args.body]).size;
  return size > RESUMABLE_THRESHOLD ? resumableUpload(token, args) : multipartUpload(token, args);
}

async function uploadJsonFile(token, { fileId, name, parents, data }) {
  const jsonBlob = new Blob([JSON.stringify(data)], { type: "application/json" });
  return multipartUpload(token, { fileId, name, parents, body: jsonBlob, mimeType: "application/json" });
}

async function deleteFile(token, fileId) {
  await driveFetch(`${DRIVE_API}/files/${fileId}`, { method: "DELETE" }, token);
}

/* ------------------------------------------------------------- sync API */

/**
 * Runs the full two-way sync. This is the single code path used for
 * first-ever sync (no remote items.json), a fresh device (empty local
 * DB), and ordinary incremental syncs — they're all the same merge.
 */
export async function syncNow() {
  emitStatus({ state: "syncing" });
  try {
    const token = await getAccessToken({ pendingAction: "sync" });
    const rootId = await ensureFolder(token, "SecondMemory", null);

    const itemsFile = await findFile(token, "items.json", rootId);
    const remoteItems = itemsFile ? await downloadJson(token, itemsFile.id) : [];
    const localItems = await db.getAllItems();

    const { merged, stats } = mergeItemSets(localItems, remoteItems);

    const remoteFileList = await listFiles(token, rootId);
    const remoteMediaNames = new Set(
      remoteFileList.filter((f) => f.name !== "items.json").map((f) => f.name)
    );
    const localMediaIds = new Set();
    for (const item of merged) {
      if (item.mediaId && !item.deletedAt) {
        const media = await db.getMedia(item.mediaId);
        if (media) localMediaIds.add(item.mediaId);
      }
    }

    const { toUpload, toDownload, toDeleteLocal } = computeMediaActions(merged, localMediaIds, remoteMediaNames);

    // Upload local-only media.
    for (const item of toUpload) {
      const media = await db.getMedia(item.mediaId);
      if (!media || !media.blob) continue;
      await uploadBlob(token, {
        name: `${item.id}__${item.filename}`,
        parents: [rootId],
        body: media.blob,
        mimeType: item.mimeType || "application/octet-stream",
      });
    }

    // Download remote-only media.
    for (const { item, remoteName } of toDownload) {
      const remoteFile = remoteFileList.find((f) => f.name === remoteName);
      if (!remoteFile) continue;
      const blob = await downloadBlob(token, remoteFile.id);
      let thumbnailBlob = null;
      if (item.type === "image") {
        try { thumbnailBlob = await db.makeThumbnail(blob); } catch (_) { thumbnailBlob = null; }
      }
      await db.putMedia({ id: item.mediaId, blob, thumbnailBlob });
    }

    // Purge local media for newly-tombstoned items, and remove the Drive copy.
    for (const item of toDeleteLocal) {
      await db.deleteMedia(item.mediaId);
      const remoteName = `${item.id}__${item.filename}`;
      const remoteFile = remoteFileList.find((f) => f.name === remoteName);
      if (remoteFile) {
        try { await deleteFile(token, remoteFile.id); } catch (_) { /* already gone */ }
      }
    }

    // Persist merged metadata locally and back to Drive.
    await db.putItems(merged);
    await uploadJsonFile(token, { fileId: itemsFile?.id, name: "items.json", parents: itemsFile ? undefined : [rootId], data: merged });

    await db.setMeta("lastSyncAt", new Date().toISOString());
    emitStatus({ state: "success", stats });
    return stats;
  } catch (err) {
    emitStatus({ state: "error", message: err.message || String(err) });
    throw err;
  }
}

export function onStatusChange(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter((f) => f !== fn); };
}

/* ---------------------------------------------------------- backup/restore */

export async function createBackup() {
  const token = await getAccessToken({ pendingAction: "backup" });
  const rootId = await ensureFolder(token, "SecondMemory", null);
  const backupsId = await ensureFolder(token, "backups", rootId);
  const items = await db.getAllItems();
  const name = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  await uploadJsonFile(token, { name, parents: [backupsId], data: items });
  return name;
}

export async function listBackups() {
  const token = await getAccessToken({ pendingAction: "backup" });
  const rootId = await ensureFolder(token, "SecondMemory", null);
  const backupsId = await ensureFolder(token, "backups", rootId);
  const files = await listFiles(token, backupsId);
  return files.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
}

/**
 * Restore a backup. mode "merge" runs it through the normal LWW merge.
 * mode "replace" makes the backup the new source of truth everywhere:
 * it overwrites local IndexedDB AND re-uploads items.json to Drive, so
 * the very next sync can't silently revert the restore.
 */
export async function restoreBackup(backupFileId, mode) {
  const token = await getAccessToken({ pendingAction: "backup" });
  const backupItems = await downloadJson(token, backupFileId);
  const rootId = await ensureFolder(token, "SecondMemory", null);

  if (mode === "replace") {
    await db.putItems(backupItems);
    const itemsFile = await findFile(token, "items.json", rootId);
    await uploadJsonFile(token, { fileId: itemsFile?.id, name: "items.json", parents: itemsFile ? undefined : [rootId], data: backupItems });
    await restoreMissingMedia(token, rootId, backupItems);
    return { mode: "replace" };
  }

  const localItems = await db.getAllItems();
  const { merged, stats } = mergeItemSets(localItems, backupItems);
  await db.putItems(merged);
  const itemsFile = await findFile(token, "items.json", rootId);
  await uploadJsonFile(token, { fileId: itemsFile?.id, name: "items.json", parents: itemsFile ? undefined : [rootId], data: merged });
  await restoreMissingMedia(token, rootId, merged);
  return { mode: "merge", stats };
}

async function restoreMissingMedia(token, rootId, items) {
  const remoteFileList = await listFiles(token, rootId);
  for (const item of items) {
    if (!item.mediaId || item.deletedAt) continue;
    const existing = await db.getMedia(item.mediaId);
    if (existing) continue;
    const remoteName = `${item.id}__${item.filename}`;
    const remoteFile = remoteFileList.find((f) => f.name === remoteName);
    if (!remoteFile) continue;
    const blob = await downloadBlob(token, remoteFile.id);
    let thumbnailBlob = null;
    if (item.type === "image") {
      try { thumbnailBlob = await db.makeThumbnail(blob); } catch (_) { thumbnailBlob = null; }
    }
    await db.putMedia({ id: item.mediaId, blob, thumbnailBlob });
  }
}

export const sync = {
  syncNow,
  onStatusChange,
  getAccessToken,
  handleRedirectReturn,
  isSignedIn,
  createBackup,
  listBackups,
  restoreBackup,
};
