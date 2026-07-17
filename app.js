/*
 * Second Memory — app entry point: bootstraps storage, i18n, theme,
 * service worker, and wires up view switching + the search/filter bar.
 * View-specific logic lives in view-list.js / view-grid.js /
 * view-detail.js / view-add.js / view-settings.js.
 */
import { db } from "./db.js";
import { i18n } from "./i18n.js";
import { state } from "./state.js";
import { toast, isStandalone, trapFocus } from "./ui.js";
import { icons } from "./icons.js";
import { sync } from "./sync.js";

import { initListView, resetAndLoadList } from "./view-list.js";
import { initGridView, resetAndLoadGrid } from "./view-grid.js";
import { initDetailView, openDetail, shareItem } from "./view-detail.js";
import { initAddView, openAdd } from "./view-add.js";
import { initSettingsView, refreshSettingsView } from "./view-settings.js";
import { refreshReportView } from "./view-report.js";

const { t } = i18n;

const appEl = document.getElementById("app");
const views = {
  list: document.getElementById("view-list"),
  grid: document.getElementById("view-grid"),
  detail: document.getElementById("view-detail"),
  add: document.getElementById("view-add"),
  settings: document.getElementById("view-settings"),
  report: document.getElementById("view-report"),
};
const tabButtons = document.querySelectorAll(".tab-btn");

/* ------------------------------------------------------------- routing */

// "detail" and "add" are reached by pushing forward from list/grid (and
// popped back via Back/Cancel) — those transitions slide like native iOS
// navigation. Switching between tab-bar destinations (list/grid/settings)
// stays instant, matching how iOS tab bars behave (no slide between tabs).
const PUSH_TARGETS = new Set(["detail", "add", "report"]);

// Scroll offset per base tab, so returning from a pushed view lands where
// you left the list — while a freshly-opened detail/add always starts at
// the top. (All views share one scroll container, so without this a detail
// would silently inherit the list's scroll position.)
const scrollPositions = {};

/**
 * Swap views, sliding like native iOS navigation via the View Transitions
 * API. The browser snapshots the old state, we mutate the DOM, and it
 * cross-animates to the new one — which replaces the hand-rolled
 * class/generation-counter machinery this used to need (and the whole
 * class of stale-class corruption bugs that came with it).
 *
 * The pinned chrome gets its own view-transition-name so it's captured
 * separately and stays put instead of sliding with the content.
 */
function showView(name) {
  const prevName = appEl.dataset.view;
  const contentEl = document.querySelector(".content");
  if (prevName) scrollPositions[prevName] = contentEl.scrollTop;

  const isForward = PUSH_TARGETS.has(name) && !PUSH_TARGETS.has(prevName);
  const isBackward = PUSH_TARGETS.has(prevName) && !PUSH_TARGETS.has(name);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const apply = () => {
    appEl.dataset.view = name;
    tabButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.view === name));
    Object.entries(views).forEach(([key, el]) => el.classList.toggle("hidden", key !== name));
    // Restoring a base tab's offset can't happen here — its list is
    // re-rendered right after this, which collapses the scroll height and
    // clamps whatever we'd set. goList/goGrid restore once their data is in.
    contentEl.scrollTop = 0;
    renderFilterIndicator();
  };

  const slide = (isForward || isBackward) && !reduceMotion && typeof document.startViewTransition === "function";
  if (!slide) { apply(); return; } // instant switch (tab hop, reduced motion, or no VT support)

  document.documentElement.dataset.nav = isForward ? "forward" : "back";
  const transition = document.startViewTransition(apply);
  transition.finished.finally(() => { delete document.documentElement.dataset.nav; });
}

// The scroll restore lands after the data, so coming back from a detail
// returns you to your place in the list instead of the top.
async function goList() {
  showView("list");
  await resetAndLoadList();
  document.querySelector(".content").scrollTop = scrollPositions.list || 0;
}
async function goGrid() {
  showView("grid");
  await resetAndLoadGrid();
  document.querySelector(".content").scrollTop = scrollPositions.grid || 0;
}
async function goSettings() { showView("settings"); await refreshSettingsView(); }

// The pushed views (detail/add/report) add a browser-history entry so the
// hardware/browser Back button and edge back-swipe pop them instead of
// leaving the PWA; chip-hopping between linked items therefore builds a
// real back-stack. `push` is false only when the navigation is itself
// being driven by a popstate (so we don't re-push what we just popped).
async function goAdd(prefill = null, push = true) {
  if (push) history.pushState({ smView: "add" }, "");
  showView("add");
  await openAdd(prefill);
}
async function goReport(push = true) {
  if (push) history.pushState({ smView: "report" }, "");
  showView("report");
  await refreshReportView();
}
async function goDetail(id, push = true) {
  if (push) history.pushState({ smView: "detail", id }, "");
  showView("detail");
  await openDetail(id);
}

// Back/Cancel buttons just pop history; the popstate handler below does
// the actual navigation, so in-app back and browser back share one path.
function backFromDetailOrAdd() { history.back(); }
function backFromReport() { history.back(); }

window.addEventListener("popstate", (e) => {
  const s = e.state || {};
  switch (s.smView) {
    case "detail": if (s.id) goDetail(s.id, false); else goList(); break;
    case "add": goAdd(null, false); break;
    case "report": goReport(false); break;
    case "grid": goGrid(); break;
    case "settings": goSettings(); break;
    case "list":
    default: goList();
  }
});

async function refreshCurrentView() {
  renderFilterIndicator();
  const current = appEl.dataset.view;
  if (current === "list") await resetAndLoadList();
  else if (current === "grid") await resetAndLoadGrid();
  else if (current === "settings") await refreshSettingsView();
}

/* ---------------------------------------------------------- tab bar UI */

document.querySelector(".tabbar").addEventListener("click", (e) => {
  const btn = e.target.closest(".tab-btn");
  if (!btn) return;
  const view = btn.dataset.view;
  if (view === "add") { openQuickSheet(); return; } // fast path; "Meer opties" opens the full form
  // The three base tabs are one history level: replace (not push) so the
  // top entry always names the tab a pushed view will nest under.
  if (view === "list" || view === "grid") appEl.dataset.prevTab = view;
  history.replaceState({ smView: view }, "");
  if (view === "list") goList();
  else if (view === "grid") goGrid();
  else if (view === "settings") goSettings();
});

document.getElementById("btn-view-report").addEventListener("click", goReport);
document.getElementById("btn-report-back").addEventListener("click", backFromReport);

/* ------------------------------------------------------- search/filter */

const searchbar = document.getElementById("searchbar");
const searchInput = document.getElementById("search-input");
const btnSearchToggle = document.getElementById("btn-search-toggle");
const btnDensityToggle = document.getElementById("btn-density-toggle");
const btnFilterToggle = document.getElementById("btn-filter-toggle");
const filterPanel = document.getElementById("filter-panel");
const typeFilterChips = document.getElementById("type-filter-chips");
const tagFilterChips = document.getElementById("tag-filter-chips");
const sortSelect = document.getElementById("sort-select");
const dateFromInput = document.getElementById("filter-date-from");
const dateToInput = document.getElementById("filter-date-to");
const btnClearFilters = document.getElementById("btn-clear-filters");
const filterActiveBar = document.getElementById("filter-active-bar");
const filterActiveText = document.getElementById("filter-active-text");

// Publish the live height of the pinned glass header to --chrome-top, so
// the scrolling content reserves exactly that much top padding. The header
// grows/shrinks as the search bar toggles and the filter panel expands, so
// syncChromeHeight() is called explicitly after each such change; a
// ResizeObserver is layered on as a belt-and-braces catch (e.g. the reflow
// when the display font finishes loading, or an orientation change).
const topChrome = document.getElementById("top-chrome");
function syncChromeHeight() {
  document.documentElement.style.setProperty("--chrome-top", `${topChrome.offsetHeight}px`);
}
if ("ResizeObserver" in window) new ResizeObserver(syncChromeHeight).observe(topChrome);
window.addEventListener("resize", syncChromeHeight);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncChromeHeight);
syncChromeHeight();

let searchDebounce = null;

btnSearchToggle.addEventListener("click", () => {
  searchbar.classList.toggle("hidden");
  if (!searchbar.classList.contains("hidden")) searchInput.focus();
  syncChromeHeight();
});

// Icon shows the CURRENT density; tapping switches to the other one.
function renderDensityToggle() {
  const isCompact = state.listDensity === "compact";
  btnDensityToggle.innerHTML = isCompact ? icons.densityCompact : icons.densityComfortable;
  btnDensityToggle.setAttribute("aria-label", t(isCompact ? "densityCompact" : "densityComfortable"));
}

btnDensityToggle.addEventListener("click", () => {
  setListDensity(state.listDensity === "compact" ? "comfortable" : "compact");
});

searchInput.addEventListener("input", () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    state.filters.search = searchInput.value.trim();
    refreshCurrentView();
  }, 250);
});

btnFilterToggle.addEventListener("click", async () => {
  filterPanel.classList.toggle("hidden");
  if (!filterPanel.classList.contains("hidden")) {
    await renderFilterChips();
    syncSortAndDateInputs();
  }
  syncChromeHeight();
});

sortSelect.addEventListener("change", () => {
  const [sortBy, sortDir] = sortSelect.value.split("-");
  state.filters.sortBy = sortBy;
  state.filters.sortDir = sortDir;
  refreshCurrentView();
});

dateFromInput.addEventListener("change", () => {
  state.filters.dateFrom = dateFromInput.value || null;
  refreshCurrentView();
});

dateToInput.addEventListener("change", () => {
  state.filters.dateTo = dateToInput.value || null;
  refreshCurrentView();
});

function syncSortAndDateInputs() {
  sortSelect.value = `${state.filters.sortBy}-${state.filters.sortDir}`;
  dateFromInput.value = state.filters.dateFrom || "";
  dateToInput.value = state.filters.dateTo || "";
}

function clearAllFilters() {
  state.filters.tags = [];
  state.filters.type = null;
  state.filters.sortBy = "created";
  state.filters.sortDir = "desc";
  state.filters.dateFrom = null;
  state.filters.dateTo = null;
  renderFilterChips();
  syncSortAndDateInputs();
  refreshCurrentView();
}

btnClearFilters.addEventListener("click", clearAllFilters);
filterActiveBar.addEventListener("click", clearAllFilters);

// Count only the filters that actually HIDE items (type/tags/date range).
// Sort isn't counted: it reorders rather than hides, and its current value
// is already visible in the sort dropdown.
function activeFilterCount() {
  const { type, tags, dateFrom, dateTo } = state.filters;
  return (type ? 1 : 0) + tags.length + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);
}

function renderFilterIndicator() {
  const count = activeFilterCount();
  // The bar lives above the scroll area (not inside it), so it's only
  // meaningful on the two views the filters actually apply to.
  const onListOrGrid = appEl.dataset.view === "list" || appEl.dataset.view === "grid";
  btnFilterToggle.classList.toggle("has-active-filters", count > 0);
  filterActiveBar.classList.toggle("hidden", count === 0 || !onListOrGrid);
  if (count > 0) filterActiveText.textContent = t("filtersActive", { count });
  syncChromeHeight(); // the active-filter bar changes the header height
}

async function activateTagFilter(tag) {
  searchbar.classList.remove("hidden");
  filterPanel.classList.remove("hidden");
  if (!state.filters.tags.includes(tag)) {
    state.filters.tags = [...state.filters.tags, tag];
  }
  await renderFilterChips();
  syncSortAndDateInputs();
  await refreshCurrentView();
}

async function togglePin(id, pinned) {
  const item = await db.getItem(id);
  if (!item) return;
  await db.putItem({ ...item, pinned, updatedAt: new Date().toISOString() });
  await refreshCurrentView();
}

/* -------------------------------------------------------- quick capture */

/**
 * The + tab opens a lightweight sheet: paste/type one thing, tap Opslaan,
 * done. A leading http(s) URL is saved as a link (titled from its domain
 * until you edit it), anything else as a text note titled from its first
 * line. "Meer opties" hands off to the full Add form with what you typed
 * already filled in, so nothing is lost by starting here.
 */
const quickSheet = document.getElementById("quick-sheet");
const quickInput = document.getElementById("quick-input");
const quickSave = document.getElementById("quick-save");
const quickMore = document.getElementById("quick-more");
const quickHint = document.getElementById("quick-hint");
let releaseQuickFocus = null;

const URL_RE = /^https?:\/\/\S+$/i;

/**
 * Offer the clipboard's contents if they're a URL, so capturing a link you
 * just copied is a single tap.
 *
 * The read MUST be kicked off synchronously inside the tap that opened the
 * sheet — the same "user activation" trap that silently broke the open-file
 * buttons: once you await anything first, iOS treats the read as
 * un-gestured and it fails with no error to catch. iOS also shows its own
 * native Paste confirmation, so this can legitimately never resolve if the
 * user ignores it; every failure path just leaves the field empty and the
 * hint hidden, which is exactly the pre-clipboard behaviour.
 */
function offerClipboardUrl() {
  quickHint.classList.add("hidden");
  if (!navigator.clipboard || !navigator.clipboard.readText) return;
  let read;
  try {
    read = navigator.clipboard.readText(); // started inside the gesture
  } catch (_) {
    return; // some engines throw synchronously when the API is blocked
  }
  read.then((text) => {
    const value = (text || "").trim();
    // Don't clobber: the paste prompt can outlive the tap, and the user may
    // have started typing (or closed the sheet) while it was up.
    if (!URL_RE.test(value)) return;
    if (quickSheet.classList.contains("hidden") || quickInput.value !== "") return;
    quickInput.value = value;
    quickHint.classList.remove("hidden");
  }).catch(() => { /* denied, dismissed, or unsupported — type it instead */ });
}

function openQuickSheet() {
  quickInput.value = "";
  offerClipboardUrl(); // first: keeps the user activation alive
  quickSheet.classList.remove("hidden");
  releaseQuickFocus = trapFocus(quickSheet, closeQuickSheet);
  quickInput.focus();
}

function closeQuickSheet() {
  if (releaseQuickFocus) { releaseQuickFocus(); releaseQuickFocus = null; }
  quickSheet.classList.add("hidden");
}

quickSheet.addEventListener("click", (e) => {
  if (e.target === quickSheet) closeQuickSheet(); // tap the backdrop
});

// Once you edit the field, the "from clipboard" note no longer describes it.
quickInput.addEventListener("input", () => quickHint.classList.add("hidden"));

/** Parses the sheet's single field into the shape the Add form expects. */
function parseQuickInput(raw) {
  const value = raw.trim();
  if (!value) return null;
  const isUrl = /^https?:\/\/\S+$/i.test(value);
  if (isUrl) {
    let title = value;
    try { title = new URL(value).hostname.replace(/^www\./, ""); } catch (_) { /* keep raw */ }
    return { type: "link", url: value, title, text: "", comment: "", tags: [] };
  }
  return { type: "text", url: "", text: value, title: value.split("\n")[0].slice(0, 80), comment: "", tags: [] };
}

quickSave.addEventListener("click", async () => {
  const prefill = parseQuickInput(quickInput.value);
  if (!prefill) { quickInput.focus(); return; }
  const now = new Date().toISOString();
  await db.putItem({
    id: db.makeId(),
    type: prefill.type,
    title: prefill.title,
    comment: "",
    tags: [],
    pinned: false,
    reminderAt: null,
    linkedIds: [],
    url: prefill.type === "link" ? prefill.url : null,
    text: prefill.type === "text" ? prefill.text : null,
    mediaId: null, filename: null, mimeType: null,
    createdAt: now, updatedAt: now, deletedAt: null,
  });
  closeQuickSheet();
  toast(t("itemSaved"), "success");
  await refreshCurrentView();
});

// Hand off to the full form, carrying whatever's been typed so far.
quickMore.addEventListener("click", () => {
  const prefill = parseQuickInput(quickInput.value);
  closeQuickSheet();
  goAdd(prefill);
});

/* ---------------------------------------------------- pull-to-refresh */

/**
 * Pull down at the very top of the list to sync (or just reload when not
 * signed in). Only arms at scrollTop 0 and only on list/grid, and bails
 * out the moment the gesture reads as horizontal — so it can't fight the
 * cards' swipe actions or ordinary scrolling. Resistance is applied so the
 * indicator trails the finger rather than tracking it 1:1.
 */
const pullIndicator = document.getElementById("pull-indicator");
const PULL_TRIGGER = 70;

function initPullToRefresh() {
  const contentEl = document.querySelector(".content");
  let startY = null;
  let startX = null;
  let pulling = false;
  let refreshing = false;

  const setPull = (ratio) => pullIndicator.style.setProperty("--pull", String(ratio));
  const reset = () => {
    pullIndicator.classList.add("settling");
    setPull(0);
    setTimeout(() => pullIndicator.classList.remove("settling"), 220);
  };

  contentEl.addEventListener("touchstart", (e) => {
    const view = appEl.dataset.view;
    if (refreshing || e.touches.length !== 1 || contentEl.scrollTop > 0) return;
    if (view !== "list" && view !== "grid") return;
    startY = e.touches[0].clientY;
    startX = e.touches[0].clientX;
    pulling = false;
  }, { passive: true });

  contentEl.addEventListener("touchmove", (e) => {
    if (startY === null || refreshing) return;
    const dy = e.touches[0].clientY - startY;
    const dx = e.touches[0].clientX - startX;
    if (!pulling && (dy <= 0 || Math.abs(dx) > Math.abs(dy))) { startY = null; return; }
    pulling = true;
    setPull(Math.min(dy / PULL_TRIGGER, 1));
  }, { passive: true });

  contentEl.addEventListener("touchend", async () => {
    if (startY === null || !pulling) { startY = null; return; }
    const triggered = parseFloat(pullIndicator.style.getPropertyValue("--pull") || "0") >= 1;
    startY = null;
    pulling = false;
    if (!triggered) { reset(); return; }

    refreshing = true;
    pullIndicator.classList.add("spinning");
    try {
      if (navigator.onLine && (await sync.isSignedIn())) {
        await sync.syncNow();
      }
      await refreshCurrentView();
    } catch (_) {
      // sync failures already surface via onStatusChange's toast
    } finally {
      pullIndicator.classList.remove("spinning");
      refreshing = false;
      reset();
    }
  });
}

/* ------------------------------------------------------- context menu */

const contextMenu = document.getElementById("context-menu");
const contextMenuTitle = document.getElementById("context-menu-title");
const ctxPin = document.getElementById("ctx-pin");
const ctxShare = document.getElementById("ctx-share");
const ctxDelete = document.getElementById("ctx-delete");
const ctxCancel = document.getElementById("ctx-cancel");

let contextItem = null;
let releaseContextFocus = null;

/** Long-press on a list card: the common actions, without opening it. */
function openContextMenu(item) {
  contextItem = item;
  contextMenuTitle.textContent = item.title;
  ctxPin.textContent = t(item.pinned ? "unpinItem" : "pinItem");
  contextMenu.classList.remove("hidden");
  releaseContextFocus = trapFocus(contextMenu, closeContextMenu);
}

function closeContextMenu() {
  if (releaseContextFocus) { releaseContextFocus(); releaseContextFocus = null; }
  contextMenu.classList.add("hidden");
  contextItem = null;
}

contextMenu.addEventListener("click", (e) => {
  if (e.target === contextMenu) closeContextMenu(); // tap the backdrop
});
ctxCancel.addEventListener("click", closeContextMenu);
ctxPin.addEventListener("click", async () => {
  const item = contextItem;
  closeContextMenu();
  await togglePin(item.id, !item.pinned);
});
ctxShare.addEventListener("click", async () => {
  const item = contextItem;
  closeContextMenu();
  await shareItem(item);
});
ctxDelete.addEventListener("click", async () => {
  const item = contextItem;
  closeContextMenu();
  await deleteItemWithUndo(item);
});

/**
 * Shared delete-with-undo path — used by both the Detail view's Delete
 * button and swipe-to-delete on list cards, so there's exactly one place
 * that implements "tombstone now, purge media only if undo isn't used."
 *
 * Undo RE-CREATES the item under a fresh id rather than clearing the
 * tombstone's deletedAt: tombstone-always-wins means a resurrected item
 * (same id) would be silently re-killed by the very next sync that saw
 * its tombstone. A new id the tombstone can't reference sidesteps that
 * entirely. For image/file items the media is cloned under a new id too,
 * because the old tombstoned item still points at the original mediaId
 * and sync would purge it (see db.cloneMedia).
 */
async function deleteItemWithUndo(item) {
  const tombstoned = { ...item, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await db.putItem(tombstoned);
  await refreshCurrentView();

  toast(t("itemDeleted"), "success", {
    actionLabel: t("undo"),
    onAction: async () => {
      const now = new Date().toISOString();
      const restored = { ...item, id: db.makeId(), deletedAt: null, updatedAt: now };
      if (item.mediaId) {
        restored.mediaId = (await db.cloneMedia(item.mediaId)) || null;
      }
      await db.putItem(restored);
      // The original media is now orphaned by a live item (only the
      // tombstone references it); purge it so it doesn't linger.
      if (item.mediaId) await db.deleteMedia(item.mediaId);
      await refreshCurrentView();
    },
    onExpire: async () => {
      if (item.mediaId) await db.deleteMedia(item.mediaId);
    },
  });
}

const TYPES = ["link", "text", "image", "file"];

async function renderFilterChips() {
  typeFilterChips.innerHTML = "";
  for (const type of TYPES) {
    const chip = document.createElement("button");
    chip.className = `chip${state.filters.type === type ? " active" : ""}`;
    chip.textContent = t(`type${type[0].toUpperCase()}${type.slice(1)}`);
    chip.addEventListener("click", () => {
      state.filters.type = state.filters.type === type ? null : type;
      renderFilterChips();
      refreshCurrentView();
    });
    typeFilterChips.appendChild(chip);
  }

  tagFilterChips.innerHTML = "";
  const allTags = await db.getAllTags();
  for (const { tag, count } of allTags) {
    const chip = document.createElement("button");
    chip.className = `chip${state.filters.tags.includes(tag) ? " active" : ""}`;
    chip.textContent = `${tag} (${count})`;
    chip.addEventListener("click", () => {
      if (state.filters.tags.includes(tag)) {
        state.filters.tags = state.filters.tags.filter((tg) => tg !== tag);
      } else {
        state.filters.tags = [...state.filters.tags, tag];
      }
      renderFilterChips();
      refreshCurrentView();
    });
    tagFilterChips.appendChild(chip);
  }
}

/* -------------------------------------------------------------- theme */

const THEMES = ["dark", "light", "midnight", "paper"];
const THEME_COLORS = { dark: "#000000", light: "#f2f2f7", midnight: "#000000", paper: "#f7f1e6" };

async function setTheme(theme) {
  if (!THEMES.includes(theme)) theme = "dark";
  state.theme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  document.querySelector('meta[name="theme-color"]').setAttribute("content", THEME_COLORS[theme]);
  await db.setMeta("theme", theme);
}

async function setLanguage(lang) {
  i18n.setLang(lang);
  state.lang = i18n.getLang();
  await db.setMeta("language", state.lang);
  i18n.applyTranslations();
  renderDensityToggle();
  await refreshCurrentView();
}

async function setListDensity(density) {
  state.listDensity = density === "compact" ? "compact" : "comfortable";
  await db.setMeta("listDensity", state.listDensity);
  renderDensityToggle();
  await refreshCurrentView();
}

/* -------------------------------------------------------- install hint */

async function maybeShowInstallHint() {
  const dismissed = await db.getMeta("installHintDismissed", false);
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent);
  if (isIOS && !isStandalone() && !dismissed) {
    document.getElementById("install-hint").classList.remove("hidden");
  }
}

document.getElementById("btn-dismiss-hint").addEventListener("click", async () => {
  document.getElementById("install-hint").classList.add("hidden");
  await db.setMeta("installHintDismissed", true);
});

/* -------------------------------------------------------------- boot */

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register("./sw.js");
    // Force an immediate check for a newer sw.js instead of waiting for
    // the browser's own (infrequent, especially on installed iOS PWAs)
    // background update check.
    registration.update().catch(() => {});

    // If the SW script itself changes and a new worker takes control
    // mid-session, reload once so the page picks up the new sw.js logic
    // right away rather than needing a manual relaunch. This doesn't
    // affect ordinary app-content updates (html/js/css) — those are
    // already served fresh on every load via the network-first fetch
    // strategy in sw.js, with no reload needed.
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  } catch (err) {
    console.error("Service worker registration failed:", err);
  }
}

async function autoSyncOnLaunch() {
  const enabled = await db.getMeta("autoSyncOnLaunch", true);
  if (!enabled || !navigator.onLine) return;
  const signedIn = await sync.isSignedIn();
  if (!signedIn) return; // don't ambush the user with a popup on every launch
  try {
    await sync.syncNow();
    await refreshCurrentView();
  } catch (err) {
    console.warn("Auto-sync failed:", err);
  }
}

/**
 * Parses a "#add?type=link&url=...&title=..." deep-link hash into Add-form
 * prefill data. This is what an iOS Shortcut added to the share sheet
 * targets — since a PWA itself can't register as a real share-sheet
 * destination, a Shortcut is the workaround: it grabs the shared URL/text
 * and opens this app with it pre-filled, one tap from the share sheet
 * to a saved item. See README for the Shortcut setup.
 */
function parseAddHash() {
  const hash = window.location.hash;
  if (!hash.startsWith("#add")) return null;
  const params = new URLSearchParams(hash.slice(4).replace(/^\?/, ""));
  const url = params.get("url") || "";
  const text = params.get("text") || "";
  const type = params.get("type") || (url ? "link" : text ? "text" : "link");
  const tagsParam = params.get("tags");
  return {
    type,
    url,
    text,
    title: params.get("title") || "",
    comment: params.get("comment") || "",
    tags: tagsParam ? tagsParam.split(",").map((tg) => tg.trim().toLowerCase()).filter(Boolean) : [],
  };
}

async function resumeAfterOAuthRedirect() {
  const pending = await sync.handleRedirectReturn();
  if (pending === "sync") {
    try {
      await sync.syncNow();
      toast(t("itemUpdated"), "success");
      await refreshCurrentView();
    } catch (_) { /* status surfaced via onStatusChange */ }
  } else if (pending === "backup") {
    toast(t("driveConnecting"), "default");
  }
}

async function boot() {
  await db.openDB();
  await db.requestPersistentStorage();

  const savedTheme = await db.getMeta("theme", "dark");
  const savedLang = await db.getMeta("language", "nl");
  const savedDensity = await db.getMeta("listDensity", "comfortable");
  await setTheme(savedTheme);
  i18n.setLang(savedLang);
  state.lang = i18n.getLang();
  state.listDensity = savedDensity === "compact" ? "compact" : "comfortable";
  i18n.applyTranslations();
  renderDensityToggle();

  initListView({ onOpenItem: goDetail, onTagClick: activateTagFilter, onTogglePin: togglePin, onSwipeDelete: deleteItemWithUndo, onLongPress: openContextMenu });
  initGridView({ onOpenItem: goDetail });
  initDetailView({ onClose: backFromDetailOrAdd, onChanged: refreshCurrentView, onDelete: deleteItemWithUndo, onNavigate: goDetail });
  initAddView({ onSaved: () => history.back(), onCancel: backFromDetailOrAdd });
  initSettingsView({ onThemeChange: setTheme, onLangChange: setLanguage, onDensityChange: setListDensity });

  initPullToRefresh();
  window.addEventListener("sm:data-changed", refreshCurrentView);

  await registerServiceWorker();
  await resumeAfterOAuthRedirect();
  await maybeShowInstallHint();

  const addPrefill = parseAddHash();

  // Establish the base history entry (also strips any #add deep-link hash
  // from the URL, read just above). Pushed views nest on top of this;
  // browser Back from the base list exits, as expected for a top-level tab.
  history.replaceState({ smView: "list" }, "", window.location.pathname + window.location.search);

  if (addPrefill) {
    appEl.dataset.prevTab = "list";
    await goAdd(addPrefill); // pushes add on top of the list base
  } else {
    await goList();
  }
  autoSyncOnLaunch();
}

boot();
