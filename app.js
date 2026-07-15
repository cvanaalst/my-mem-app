/*
 * Second Memory — app entry point: bootstraps storage, i18n, theme,
 * service worker, and wires up view switching + the search/filter bar.
 * View-specific logic lives in view-list.js / view-grid.js /
 * view-detail.js / view-add.js / view-settings.js.
 */
import { db } from "./db.js";
import { i18n } from "./i18n.js";
import { state } from "./state.js";
import { toast } from "./ui.js";
import { sync } from "./sync.js";

import { initListView, resetAndLoadList } from "./view-list.js";
import { initGridView, resetAndLoadGrid } from "./view-grid.js";
import { initDetailView, openDetail } from "./view-detail.js";
import { initAddView, openAdd } from "./view-add.js";
import { initSettingsView, refreshSettingsView } from "./view-settings.js";

const { t } = i18n;

const appEl = document.getElementById("app");
const views = {
  list: document.getElementById("view-list"),
  grid: document.getElementById("view-grid"),
  detail: document.getElementById("view-detail"),
  add: document.getElementById("view-add"),
  settings: document.getElementById("view-settings"),
};
const tabButtons = document.querySelectorAll(".tab-btn");

/* ------------------------------------------------------------- routing */

// "detail" and "add" are reached by pushing forward from list/grid (and
// popped back via Back/Cancel) — those transitions slide like native iOS
// navigation. Switching between tab-bar destinations (list/grid/settings)
// stays instant, matching how iOS tab bars behave (no slide between tabs).
const PUSH_TARGETS = new Set(["detail", "add"]);

function showView(name) {
  const prevName = appEl.dataset.view;
  appEl.dataset.view = name;
  tabButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.view === name));

  const fromEl = views[prevName];
  const toEl = views[name];
  const isForward = PUSH_TARGETS.has(name) && !PUSH_TARGETS.has(prevName);
  const isBackward = PUSH_TARGETS.has(prevName) && !PUSH_TARGETS.has(name);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!fromEl || fromEl === toEl || reduceMotion || (!isForward && !isBackward)) {
    Object.entries(views).forEach(([key, el]) => el.classList.toggle("hidden", key !== name));
    window.scrollTo(0, 0);
    return;
  }

  animateViewSwap(fromEl, toEl, isForward);
  window.scrollTo(0, 0);
}

function animateViewSwap(fromEl, toEl, isForward) {
  toEl.classList.remove("hidden");
  fromEl.classList.add("view-anim");
  toEl.classList.add("view-anim", isForward ? "view-from-right" : "view-from-left");

  // Force a reflow so the browser commits the "from" transform before we
  // switch to the settled state — otherwise both changes get batched into
  // one frame and there's nothing to animate.
  void toEl.offsetWidth;

  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    fromEl.classList.add("hidden");
    fromEl.classList.remove("view-anim", "view-to-left", "view-to-right");
    toEl.classList.remove("view-anim", "view-settled");
    toEl.removeEventListener("transitionend", cleanup);
  };

  requestAnimationFrame(() => {
    toEl.classList.remove("view-from-right", "view-from-left");
    toEl.classList.add("view-settled");
    fromEl.classList.add(isForward ? "view-to-left" : "view-to-right");
  });

  toEl.addEventListener("transitionend", cleanup, { once: true });
  setTimeout(cleanup, 400); // safety net in case transitionend never fires
}

async function goList() { showView("list"); await resetAndLoadList(); }
async function goGrid() { showView("grid"); await resetAndLoadGrid(); }
async function goSettings() { showView("settings"); await refreshSettingsView(); }
async function goAdd(prefill = null) { showView("add"); await openAdd(prefill); }

async function goDetail(id) {
  showView("detail");
  await openDetail(id);
}

function backFromDetailOrAdd() {
  // Return to whichever tab was active before, defaulting to list.
  const prev = appEl.dataset.prevTab || "list";
  if (prev === "grid") goGrid(); else goList();
}

async function refreshCurrentView() {
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
  if (view === "list" || view === "grid") appEl.dataset.prevTab = view;
  if (view === "list") goList();
  else if (view === "grid") goGrid();
  else if (view === "add") goAdd();
  else if (view === "settings") goSettings();
});

/* ------------------------------------------------------- search/filter */

const searchbar = document.getElementById("searchbar");
const searchInput = document.getElementById("search-input");
const btnSearchToggle = document.getElementById("btn-search-toggle");
const btnFilterToggle = document.getElementById("btn-filter-toggle");
const filterPanel = document.getElementById("filter-panel");
const typeFilterChips = document.getElementById("type-filter-chips");
const tagFilterChips = document.getElementById("tag-filter-chips");
const sortSelect = document.getElementById("sort-select");
const dateFromInput = document.getElementById("filter-date-from");
const dateToInput = document.getElementById("filter-date-to");
const btnClearFilters = document.getElementById("btn-clear-filters");

let searchDebounce = null;

btnSearchToggle.addEventListener("click", () => {
  searchbar.classList.toggle("hidden");
  if (!searchbar.classList.contains("hidden")) searchInput.focus();
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

btnClearFilters.addEventListener("click", () => {
  state.filters.tags = [];
  state.filters.type = null;
  state.filters.sortBy = "created";
  state.filters.sortDir = "desc";
  state.filters.dateFrom = null;
  state.filters.dateTo = null;
  renderFilterChips();
  syncSortAndDateInputs();
  refreshCurrentView();
});

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

/**
 * Shared delete-with-undo path — used by both the Detail view's Delete
 * button and swipe-to-delete on list cards, so there's exactly one place
 * that implements "tombstone now, purge media only if undo isn't used."
 * Deferring the media purge is what makes Undo actually restore the
 * item's image/file instead of leaving it gone.
 */
async function deleteItemWithUndo(item) {
  const tombstoned = { ...item, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await db.putItem(tombstoned);
  await refreshCurrentView();

  toast(t("itemDeleted"), "success", {
    actionLabel: t("undo"),
    onAction: async () => {
      await db.putItem({ ...tombstoned, deletedAt: null, updatedAt: new Date().toISOString() });
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
  await refreshCurrentView();
}

async function setListDensity(density) {
  state.listDensity = density === "compact" ? "compact" : "comfortable";
  await db.setMeta("listDensity", state.listDensity);
  await refreshCurrentView();
}

/* -------------------------------------------------------- install hint */

function isStandalone() {
  return window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
}

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

  initListView({ onOpenItem: goDetail, onTagClick: activateTagFilter, onTogglePin: togglePin, onSwipeDelete: deleteItemWithUndo });
  initGridView({ onOpenItem: goDetail });
  initDetailView({ onClose: backFromDetailOrAdd, onChanged: refreshCurrentView, onDelete: deleteItemWithUndo });
  initAddView({ onSaved: goList, onCancel: backFromDetailOrAdd });
  initSettingsView({ onThemeChange: setTheme, onLangChange: setLanguage, onDensityChange: setListDensity });

  window.addEventListener("sm:data-changed", refreshCurrentView);

  await registerServiceWorker();
  await resumeAfterOAuthRedirect();
  await maybeShowInstallHint();

  const addPrefill = parseAddHash();
  if (addPrefill) {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    appEl.dataset.prevTab = "list";
    await goAdd(addPrefill);
  } else {
    await goList();
  }
  autoSyncOnLaunch();
}

boot();
