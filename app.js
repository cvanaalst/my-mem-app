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

function showView(name) {
  Object.entries(views).forEach(([key, el]) => el.classList.toggle("hidden", key !== name));
  appEl.dataset.view = name;
  tabButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.view === name));
  window.scrollTo(0, 0);
}

async function goList() { showView("list"); await resetAndLoadList(); }
async function goGrid() { showView("grid"); await resetAndLoadGrid(); }
async function goSettings() { showView("settings"); await refreshSettingsView(); }
async function goAdd() { showView("add"); await openAdd(); }

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
  if (!filterPanel.classList.contains("hidden")) await renderFilterChips();
});

btnClearFilters.addEventListener("click", () => {
  state.filters.tags = [];
  state.filters.type = null;
  renderFilterChips();
  refreshCurrentView();
});

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
  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("./sw.js");
    } catch (err) {
      console.error("Service worker registration failed:", err);
    }
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
  await setTheme(savedTheme);
  i18n.setLang(savedLang);
  state.lang = i18n.getLang();
  i18n.applyTranslations();

  initListView({ onOpenItem: goDetail });
  initGridView({ onOpenItem: goDetail });
  initDetailView({ onClose: backFromDetailOrAdd, onChanged: refreshCurrentView });
  initAddView({ onSaved: goList, onCancel: backFromDetailOrAdd });
  initSettingsView({ onThemeChange: setTheme, onLangChange: setLanguage });

  window.addEventListener("sm:data-changed", refreshCurrentView);

  await registerServiceWorker();
  await resumeAfterOAuthRedirect();
  await maybeShowInstallHint();

  await goList();
  autoSyncOnLaunch();
}

boot();
