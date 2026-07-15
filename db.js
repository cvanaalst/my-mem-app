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
      const haystack = normalizeSearchText(`${item.title || ""} ${item.comment || ""} ${item.text || ""} ${item.url || ""}`);
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
  putMedia,
  getMedia,
  deleteMedia,
  getMeta,
  setMeta,
  makeFullImage,
  makeThumbnail,
  requestPersistentStorage,
  getStorageEstimate,
  normalizeSearchText,
};
