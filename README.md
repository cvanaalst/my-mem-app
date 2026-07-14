# Second Memory

A personal, private "second brain" PWA for quickly saving and retrieving links, text snippets, photos, and files. Runs fully offline on iPhone, iPad, and Mac, stores everything locally in IndexedDB, and syncs two-way with your own Google Drive.

Vanilla HTML/CSS/JavaScript — no framework, no build step, no npm dependencies. Deployable as static files on GitHub Pages.

## 1. Google Cloud setup

Sync needs an OAuth Client ID so the app can talk to *your own* Google Drive on your behalf. Nobody else can use it — the app only ever requests the `drive.file` scope, meaning it can only see files it created itself.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a new project (or reuse one).
2. **APIs & Services → Library** → search for "Google Drive API" → **Enable**.
3. **APIs & Services → OAuth consent screen**:
   - User type: **External**.
   - App name: "Second Memory" (or anything), your email as support/contact.
   - Scopes: you don't need to add `drive.file` here manually — it's requested at runtime — but you can add it if you want it listed.
   - Test users: add your own Google account.
   - Once set up, go to **Publishing status** and click **Publish App**. Because `drive.file` is a non-sensitive scope, Google does **not** require app verification — publishing just avoids the 7-day test-token expiry that "Testing" mode has, so you don't have to re-consent every week.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Name: anything, e.g. "Second Memory Web".
   - **Authorized JavaScript origins**: add `https://<your-username>.github.io` (no trailing path).
   - **Authorized redirect URIs**: add the exact URL the app will be served at, e.g. `https://<your-username>.github.io/my-mem-app/index.html` — this is used by the iOS standalone-mode fallback login (see "Why a redirect fallback" below). Add it with and without the trailing `index.html` if you're not sure which your browser will show in the address bar; Google allows multiple redirect URIs on one client.
   - Create it, then copy the **Client ID** (ends in `.apps.googleusercontent.com`).
5. Open [`sync.js`](sync.js) and paste your Client ID into the `GOOGLE_CLIENT_ID` constant near the top (clearly marked `CONFIG` section).

You do **not** need a client secret — this app never uses one (see below).

### Why a redirect fallback, and why no PKCE

Popup-based OAuth (Google Identity Services' normal flow) is unreliable inside an iOS Home-Screen web app — Safari's standalone WebView frequently blocks or silently drops the popup. When that happens (or whenever the app detects it's running standalone), it falls back to a full-page redirect using the OAuth 2.0 **implicit flow** (`response_type=token`). This is secretless and works for a plain static-file client.

The original idea of using authorization-code + PKCE as the fallback (no client secret) turned out not to be viable: Google's token endpoint requires a `client_secret` for any OAuth client of type "Web application", even when PKCE is used — the secretless PKCE exchange is only allowed for "installed app" client types (iOS/Android/Desktop), whose redirect URIs can't point at a GitHub Pages URL. Embedding a secret in public static JS was rejected as the wrong trade-off for this app, so the implicit flow is the deliberate choice. The practical cost: no refresh tokens, so every sync after the ~1 hour token expiry needs a fresh, explicit sign-in (a tap, not automatic).

## 2. GitHub Pages deployment

1. Create a new **public** GitHub repository (Pages on the free tier requires public), e.g. `my-mem-app`.
2. Push this folder's contents to it:
   ```bash
   cd my-mem-app
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/my-mem-app.git
   git push -u origin main
   ```
3. **Settings → Pages** → Source: "Deploy from a branch" → Branch: `main`, folder `/ (root)` → Save.
4. Wait a minute, then note the published URL — typically `https://<your-username>.github.io/my-mem-app/`.
5. **Double-check this exact URL matches** the Authorized JavaScript origin and redirect URI you set in Google Cloud (step 1.4). A mismatch is the #1 cause of OAuth errors.

## 3. iOS / iPadOS installation

1. Open the GitHub Pages URL in **Safari** (not Chrome — Add to Home Screen with a proper standalone manifest needs Safari on iOS).
2. Tap **Share** → **Add to Home Screen** → Add.
3. Repeat on each device (iPhone, iPad).
4. On the very first launch on a new device, tap **Sync now** in Settings — since your Drive already has data from another device (or none, if this is truly the first device), this pulls everything down. A "restore" is just the ordinary sync algorithm running against an empty local database — there's no separate restore step needed for a normal first sync.

Note: because iOS Safari doesn't support the Web Share Target API, Second Memory can't register as a share-sheet destination. Quick capture on iPhone is: copy the link/text → open the app → Add → paste (a **Paste** button is provided next to the URL field).

## 4. Known limitations

- **Token lifetime (~1 hour).** There's no silent refresh — the implicit OAuth flow doesn't issue refresh tokens. Sync is always an explicit action: the sync button, or auto-sync on launch (only when a still-valid cached token exists — it never pops a login prompt automatically on startup).
- **Safari storage eviction.** Safari can evict IndexedDB/Cache Storage data for sites that haven't been used in a while, or under device storage pressure. The app calls `navigator.storage.persist()` on startup to ask for persistent (non-evictable) storage — Settings → Storage shows whether the browser granted it. If it wasn't granted, open the app regularly and keep it installed to Home Screen (standalone PWAs are less likely to be evicted than plain Safari tabs).
- **1600 px image policy.** Photos are resized client-side to a maximum of 1600 px on the longest side (JPEG, quality ~0.85) before being stored or synced — this keeps local storage and Drive usage reasonable. The original full-resolution file is not kept. A 300 px thumbnail is generated alongside for grid/list views.
- **No iOS share-sheet capture.** See the note in section 3 — this is a platform limitation of iOS Safari PWAs, not something this app can work around.
- **Delete beats edit.** If you delete an item on one device and edit the same item on another device before syncing, the delete always wins once they sync — even if the edit happened later. This is deliberate: resurrecting an item whose media may already be gone from Drive was judged worse than occasionally losing a late edit. Deletes are terminal.
- **Large files.** Files over 10 MB show a confirmation dialog before syncing (large files slow down sync); anything under 5 MB uploads in one request, larger files use Drive's resumable upload endpoint automatically.
- **Single-writer race.** If two devices sync at literally the same moment, the last one to write `items.json` wins for that sync cycle. Per-record last-write-wins merging limits the damage to that one cycle; there's no server-side locking (this app talks to Drive via plain `fetch()`, no backend of its own).

## Project structure

```
index.html          — app shell, all views (list/grid/detail/add/settings)
style.css            — 4 themes (dark/light/midnight/paper) via CSS custom properties
app.js               — bootstrap, routing, search/filter, theme/language
state.js             — shared in-memory UI state
i18n.js              — NL/EN translation dictionary
db.js                — IndexedDB layer (items/media/meta), image resize pipeline
ui.js                — toast/dialog/tag-input/date-format helpers
view-list.js         — list view
view-grid.js         — photo grid + lightbox
view-detail.js       — detail/edit/delete/share
view-add.js          — add-item form
view-settings.js     — sync/backup/export/theme/language/storage settings
merge.js             — pure, dependency-free merge logic (unit-tested in tests.html)
sync.js              — Google Drive OAuth + REST sync, built on merge.js
sw.js                — service worker (offline app shell)
manifest.webmanifest — PWA manifest
icons/               — app icons (generate_icons.py regenerates placeholders)
tests.html           — browser-run unit tests for merge.js, no framework
```

## Running locally

Any static file server works, e.g.:

```bash
python3 -m http.server 8420
```

Then open `http://localhost:8420/` (or `/tests.html` to run the merge-logic tests). Note that Google sign-in requires an Authorized JavaScript origin matching whatever host/port you use — `http://localhost:8420` can be added as an additional origin in the OAuth client if you want to test sync locally.
