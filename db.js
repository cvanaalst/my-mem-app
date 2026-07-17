/*
 * Second Memory — IndexedDB layer.
 *
 * Database: "second-memory"
 * Stores:
 *   items  (keyPath "id")  — metadata records, see the shape in the spec.
 *   media  (keyPath "id")  — { id, blob, thumbnailBlob } for image/file items.
 *   meta   (keyPath "key") — sync state & settings, simple key/value.
 *
 * All functions return Promises. IndexedDB's own eventing is wrapped once
 * here (see requestToPromise/txDone) so the rest of the app never touches
 * raw IDBRequest/IDBTransaction objects.
 *
 * Item collections are read fully into memory for filtering/sorting
 * (search, tag AND-filter, type filter, reverse-chronological order).
 * That's a deliberate simplification: this is a single-user, personal-scale
 * app (thousands of items, not millions), so a compound-index cursor
 * strategy would add real complexity for no practical benefit.
 */

const DB_NAME = "second-memory";
const DB_VERSION = 1;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = req.result;
      const oldVersion = event.oldVersion;

      if (oldVersion < 1) {
        const items = db.createObjectStore("items", { keyPath: "id" });
        items.createIndex("updatedAt", "updatedAt");
        items.createIndex("type", "type");
        items.createIndex("tags", "tags", { multiEntry: true });

        db.createObjectStore("media", { keyPath: "id" });
        db.createObjectStore("meta", { keyPath: "key" });
      }
      // Future migrations: `if (oldVersion < 2) { ... }` etc.
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function requestToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(storeNames, mode, work) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeNames, mode);
    let result;
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error("Transaction aborted"));
    Promise.resolve(work(transaction))
      .then((r) => { result = r; })
      .catch((err) => {
        try { transaction.abort(); } catch (_) { /* already finished */ }
        reject(err);
      });
  });
}

/* ---------------------------------------------------------------- items */

/** Generate a unique id for a new item or media record. */
function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function putItem(item) {
  return tx(["items"], "readwrite", (t) => requestToPromise(t.objectStore("items").put(item)));
}

async function putItems(items) {
  return tx(["items"], "readwrite", (t) => {
    const store = t.objectStore("items");
    return Promise.all(items.map((item) => requestToPromise(store.put(item))));
  });
}

function normalizeUrl(url) {
  return (url || "").trim().toLowerCase().replace(/\/+$/, "");
}

/** Finds a live link item with the same URL (normalized), excluding excludeId (the item being edited, if any). */
async function findDuplicateLink(url, excludeId = null) {
  if (!url) return null;
  const target = normalizeUrl(url);
  const all = await getAllItems();
  return all.find((i) => i.id !== excludeId && i.type === "link" && !i.deletedAt && normalizeUrl(i.url) === target) || null;
}

async function getItem(id) {
  return tx(["items"], "readonly", (t) => requestToPromise(t.objectStore("items").get(id)));
}

async function getAllItems() {
  return tx(["items"], "readonly", (t) => requestToPromise(t.objectStore("items").getAll()));
}

/**
 * Query live (non-deleted) items with search/tag/type filtering,
 * reverse-chronological by default, paginated.
 * opts: { search, tags: string[], type, offset, limit, sortBy, sortDir, dateFrom, dateTo }
 * Returns { results, total, hasMore }
 */
async function queryItems(opts = {}) {
  const {
    search = "", tags = [], type = null, offset = 0, limit = 30,
    sortBy = "created", sortDir = "desc", dateFrom = null, dateTo = null,
  } = opts;
  const all = await getAllItems();
  const needle = normalizeSearchText(search);

  let filtered = all.filter((item) => {
    if (item.deletedAt) return false;
    if (type && item.type !== type) return false;
    if (tags.length > 0) {
      const itemTags = item.tags || [];
      if (!tags.every((t) => itemTags.includes(t))) return false;
    }
    if (needle) {
      const haystack = normalizeSearchText(`${item.title || ""} ${item.comment || ""} ${item.text || ""} ${item.url || ""} ${listSearchText(item.listItems)}`);
      const words = needle.split(/\s+/).filter(Boolean);
      if (!words.every((w) => haystack.includes(w))) return false;
    }
    return true;
  });

  filtered = applyDateRange(filtered, dateFrom, dateTo);
  filtered = sortItems(filtered, sortBy, sortDir);

  const total = filtered.length;
  const results = filtered.slice(offset, offset + limit);
  return { results, total, hasMore: offset + limit < total };
}

/** All image items for the photo grid, with the same sort/date-range options as queryItems. */
async function getImageItems(opts = {}) {
  const { sortBy = "created", sortDir = "desc", dateFrom = null, dateTo = null } = opts;
  const all = await getAllItems();
  let images = all.filter((item) => item.type === "image" && !item.deletedAt);
  images = applyDateRange(images, dateFrom, dateTo);
  return sortItems(images, sortBy, sortDir);
}

/** Filters items to those whose createdAt falls within [dateFrom, dateTo] (both "YYYY-MM-DD", inclusive). */
function applyDateRange(items, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return items;
  const toBound = dateTo ? `${dateTo}T23:59:59.999Z` : null;
  return items.filter((item) => {
    const created = item.createdAt || "";
    if (dateFrom && created < dateFrom) return false;
    if (toBound && created > toBound) return false;
    return true;
  });
}

/**
 * Sorts a copy of items by createdAt/updatedAt, ascending or descending.
 * Pinned items are always grouped first, each group sorted independently
 * so the chosen sort direction still applies within pinned/unpinned.
 */
function sortItems(items, sortBy, sortDir) {
  const field = sortBy === "updated" ? "updatedAt" : "createdAt";
  const orderGroup = (group) => {
    const sorted = [...group].sort((a, b) => (a[field] || "").localeCompare(b[field] || ""));
    return sortDir === "asc" ? sorted : sorted.reverse();
  };
  const pinned = items.filter((item) => item.pinned);
  const unpinned = items.filter((item) => !item.pinned);
  return [...orderGroup(pinned), ...orderGroup(unpinned)];
}

/** Distinct tags across all live items, with counts, alphabetical — used by the filter panel, where alphabetical is easiest to scan. */
async function getAllTags() {
  const all = await getAllItems();
  const counts = new Map();
  for (const item of all) {
    if (item.deletedAt) continue;
    for (const tag of item.tags || []) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => a.tag.localeCompare(b.tag));
}

/**
 * Pure: sorts tag usage stats by recency of last use (max createdAt among
 * items carrying the tag) first, then by how often it's used, then
 * alphabetically. Kept separate from getRecentTags() so it's directly
 * unit-testable without touching IndexedDB (see tests.html).
 */
function sortTagsByRecency(tagStats) {
  return [...tagStats].sort((a, b) => {
    if (a.lastUsed !== b.lastUsed) return b.lastUsed.localeCompare(a.lastUsed);
    if (a.count !== b.count) return b.count - a.count;
    return a.tag.localeCompare(b.tag);
  });
}

/**
 * Distinct tags across all live items, ordered by most-recently-used
 * first — for the tag suggestion chips while typing, where "the tag I
 * used yesterday" is a better bet than "the tag I've used 50 times
 * total but not since January."
 */
async function getRecentTags() {
  const all = await getAllItems();
  const info = new Map();
  for (const item of all) {
    if (item.deletedAt) continue;
    for (const tag of item.tags || []) {
      const entry = info.get(tag) || { tag, count: 0, lastUsed: "" };
      entry.count += 1;
      if ((item.createdAt || "") > entry.lastUsed) entry.lastUsed = item.createdAt || "";
      info.set(tag, entry);
    }
  }
  return sortTagsByRecency(Array.from(info.values()));
}

function normalizeSearchText(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // strip diacritics
}

/* ---------------------------------------------------------------- lists */

/** Pure: {done, total} for a checklist's rows (list item type). */
function listProgress(listItems) {
  const items = listItems || [];
  return { done: items.filter((r) => r && r.done).length, total: items.length };
}

/** All row text of a list item, joined — used to fold list contents into search. */
function listSearchText(listItems) {
  return (listItems || []).map((r) => (r && r.text) || "").join(" ");
}

/* --------------------------------------------------------------- links */

/**
 * Pure: items are linked one-directionally (item.linkedIds points at
 * others), but the Detail view shows backlinks too, so a link is
 * discoverable from either end without a second write. Kept separate
 * from getBacklinks() so it's directly unit-testable (see tests.html).
 */
function computeBacklinks(items, itemId) {
  return items.filter((item) => !item.deletedAt && item.id !== itemId && (item.linkedIds || []).includes(itemId));
}

async function getBacklinks(itemId) {
  return computeBacklinks(await getAllItems(), itemId);
}

/**
 * Pure: one pass over every live item to find which ones participate in
 * at least one link, in either direction — for the list view's link
 * badge, which needs a yes/no per card rather than a full backlink list.
 * A dangling linkedIds entry (target got deleted) doesn't count on
 * either end, matching how the Detail view drops dead links on render.
 */
function computeLinkedIdSet(items) {
  const liveIds = new Set(items.filter((item) => !item.deletedAt).map((item) => item.id));
  const linked = new Set();
  for (const item of items) {
    if (item.deletedAt) continue;
    for (const linkedId of item.linkedIds || []) {
      if (liveIds.has(linkedId)) {
        linked.add(item.id);
        linked.add(linkedId);
      }
    }
  }
  return linked;
}

async function getLinkedIdSet() {
  return computeLinkedIdSet(await getAllItems());
}

/* -------------------------------------------------------------- report */

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1) - day; // shift back to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Pure: buckets items into the last `weekCount` weeks (oldest to newest,
 * Monday-aligned) by createdAt, for the reporting view's chart. `now` is
 * injectable so this is directly unit-testable (see tests.html) without
 * depending on the real clock.
 */
function bucketItemsByWeek(items, weekCount, now = new Date()) {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const startOfCurrentWeek = startOfWeek(now);
  const buckets = [];
  for (let i = weekCount - 1; i >= 0; i--) {
    const weekStart = new Date(startOfCurrentWeek.getTime() - i * msPerWeek);
    buckets.push({ weekStart: weekStart.toISOString().slice(0, 10), count: 0 });
  }
  for (const item of items) {
    if (!item.createdAt) continue;
    const created = new Date(item.createdAt).getTime();
    for (const bucket of buckets) {
      const bStart = new Date(bucket.weekStart).getTime();
      if (created >= bStart && created < bStart + msPerWeek) {
        bucket.count++;
        break;
      }
    }
  }
  return buckets;
}

/** Summary stats for the reporting view: counts by type, pinned/reminders-due counts, and a 12-week activity chart. */
async function getStats() {
  const all = await getAllItems();
  const live = all.filter((item) => !item.deletedAt);
  const byType = { link: 0, text: 0, image: 0, file: 0 };
  let pinnedCount = 0;
  let remindersDueCount = 0;
  const today = new Date().toISOString().slice(0, 10);
  for (const item of live) {
    if (byType[item.type] !== undefined) byType[item.type]++;
    if (item.pinned) pinnedCount++;
    if (item.reminderAt && item.reminderAt <= today) remindersDueCount++;
  }
  return {
    total: live.length,
    byType,
    pinnedCount,
    remindersDueCount,
    byWeek: bucketItemsByWeek(live, 12),
  };
}

/* ---------------------------------------------------------------- media */

async function putMedia(record) {
  return tx(["media"], "readwrite", (t) => requestToPromise(t.objectStore("media").put(record)));
}

async function getMedia(id) {
  return tx(["media"], "readonly", (t) => requestToPromise(t.objectStore("media").get(id)));
}

async function deleteMedia(id) {
  return tx(["media"], "readwrite", (t) => requestToPromise(t.objectStore("media").delete(id)));
}

/**
 * Copy an existing media record under a fresh id. Used by undo-delete,
 * which re-creates an item under a new id (so a tombstone can't re-kill
 * it on the next sync) — the media must be copied too, because the old
 * tombstoned item still references the original mediaId and sync would
 * purge it. Returns the new mediaId, or null if the source is gone.
 */
async function cloneMedia(sourceId) {
  const media = await getMedia(sourceId);
  if (!media || !media.blob) return null;
  const newId = makeId();
  await putMedia({ id: newId, blob: media.blob, thumbnailBlob: media.thumbnailBlob || null });
  return newId;
}

/* ----------------------------------------------------------------- meta */

async function getMeta(key, defaultValue = null) {
  const record = await tx(["meta"], "readonly", (t) => requestToPromise(t.objectStore("meta").get(key)));
  return record ? record.value : defaultValue;
}

async function setMeta(key, value) {
  return tx(["meta"], "readwrite", (t) => requestToPromise(t.objectStore("meta").put({ key, value })));
}

/* ---------------------------------------------------------- image utils */

/**
 * Resize an image Blob so its longest side is at most maxDimension,
 * re-encoded as JPEG at the given quality. Uses createImageBitmap where
 * available (fast, off-main-thread decode) and falls back to an <img> +
 * canvas otherwise (older WebKit).
 */
async function resizeImage(blob, maxDimension, quality) {
  const { bitmap, width, height } = await loadImage(blob);

  let targetW = width;
  let targetH = height;
  if (Math.max(width, height) > maxDimension) {
    const scale = maxDimension / Math.max(width, height);
    targetW = Math.round(width * scale);
    targetH = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);

  if (bitmap.close) bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Canvas toBlob failed"))),
      "image/jpeg",
      quality
    );
  });
}

async function loadImage(blob) {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      return { bitmap, width: bitmap.width, height: bitmap.height };
    } catch (_) {
      // Fall through to <img> fallback (some HEIC/edge cases on older Safari).
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    return { bitmap: img, width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function makeFullImage(blob) {
  return resizeImage(blob, 1600, 0.85);
}

async function makeThumbnail(blob) {
  return resizeImage(blob, 300, 0.8);
}

/* ------------------------------------------------------------- storage */

async function requestPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    try {
      return await navigator.storage.persist();
    } catch (_) {
      return false;
    }
  }
  return false;
}

async function getStorageEstimate() {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      return await navigator.storage.estimate();
    } catch (_) {
      return null;
    }
  }
  return null;
}

export const db = {
  openDB,
  makeId,
  putItem,
  putItems,
  findDuplicateLink,
  getItem,
  getAllItems,
  queryItems,
  getImageItems,
  getAllTags,
  getRecentTags,
  sortTagsByRecency,
  getStats,
  bucketItemsByWeek,
  computeBacklinks,
  getBacklinks,
  computeLinkedIdSet,
  getLinkedIdSet,
  listProgress,
  listSearchText,
  putMedia,
  getMedia,
  deleteMedia,
  cloneMedia,
  getMeta,
  setMeta,
  makeFullImage,
  makeThumbnail,
  requestPersistentStorage,
  getStorageEstimate,
  normalizeSearchText,
};
