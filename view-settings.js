/*
 * Second Memory — settings view: sync, backup/restore, export, theme,
 * language, storage info.
 */
import { db } from "./db.js";
import { state } from "./state.js";
import { i18n } from "./i18n.js";
import { toast, confirmDialog, alertDialog, formatDate, formatBytes, escapeHtml } from "./ui.js";
import { sync } from "./sync.js";
import { APP_VERSION } from "./version.js";

const { t } = i18n;
const versionTextEl = document.getElementById("version-text");

const btnSyncNow = document.getElementById("btn-sync-now");
const syncStatusEl = document.getElementById("sync-status");
const toggleAutosync = document.getElementById("toggle-autosync");
const btnBackup = document.getElementById("btn-backup");
const btnRestore = document.getElementById("btn-restore");
const backupListEl = document.getElementById("backup-list");
const btnExportJson = document.getElementById("btn-export-json");
const btnExportCsv = document.getElementById("btn-export-csv");
const themeSelector = document.getElementById("theme-selector");
const selectLanguage = document.getElementById("select-language");
const selectDensity = document.getElementById("select-density");
const storageInfoEl = document.getElementById("storage-info");
const btnPrintOverview = document.getElementById("btn-print-overview");
const printOverviewEl = document.getElementById("print-overview");

const TYPE_LABEL_KEYS = { link: "typeLink", text: "typeText", image: "typeImage", file: "typeFile" };
const TYPE_ORDER = ["link", "text", "image", "file"];

let onThemeChange = () => {};
let onLangChange = () => {};
let onDensityChange = () => {};

export function initSettingsView(handlers) {
  onThemeChange = handlers.onThemeChange;
  onLangChange = handlers.onLangChange;
  onDensityChange = handlers.onDensityChange;

  btnSyncNow.addEventListener("click", runSync);
  toggleAutosync.addEventListener("change", () => {
    db.setMeta("autoSyncOnLaunch", toggleAutosync.checked);
  });
  btnBackup.addEventListener("click", runBackup);
  btnRestore.addEventListener("click", showBackupList);
  btnExportJson.addEventListener("click", () => exportData("json"));
  btnExportCsv.addEventListener("click", () => exportData("csv"));
  btnPrintOverview.addEventListener("click", printOverview);
  window.addEventListener("afterprint", () => {
    document.body.classList.remove("printing-overview");
    printOverviewEl.innerHTML = "";
  });

  themeSelector.addEventListener("click", (e) => {
    const btn = e.target.closest(".theme-swatch");
    if (!btn) return;
    onThemeChange(btn.dataset.theme);
    highlightTheme(btn.dataset.theme);
  });

  selectLanguage.addEventListener("change", () => onLangChange(selectLanguage.value));
  selectDensity.addEventListener("change", () => onDensityChange(selectDensity.value));

  sync.onStatusChange(renderSyncStatus);
}

export async function refreshSettingsView() {
  toggleAutosync.checked = await db.getMeta("autoSyncOnLaunch", true);
  selectLanguage.value = state.lang;
  selectDensity.value = state.listDensity;
  highlightTheme(state.theme);
  await renderLastSync();
  await renderStorageInfo();
  versionTextEl.textContent = t("versionInfo", APP_VERSION);
}

function highlightTheme(theme) {
  themeSelector.querySelectorAll(".theme-swatch").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.theme === theme);
  });
}

async function renderLastSync() {
  const last = await db.getMeta("lastSyncAt");
  syncStatusEl.textContent = last ? t("syncLastSync", { date: formatDate(last) }) : t("syncIdle");
}

function renderSyncStatus(status) {
  if (status.state === "syncing") {
    syncStatusEl.textContent = t("syncSyncing");
  } else if (status.state === "success") {
    syncStatusEl.textContent = t("syncSuccess", status.stats);
    toast(t("syncSuccess", status.stats), "success");
  } else if (status.state === "error") {
    syncStatusEl.textContent = t("syncError", { message: status.message });
    toast(t("syncError", { message: status.message }), "error");
  }
}

async function runSync() {
  if (!navigator.onLine) { toast(t("offlineNotice"), "error"); return; }
  try {
    await sync.syncNow();
    await renderLastSync();
  } catch (_) {
    // status already surfaced via onStatusChange
  }
}

async function runBackup() {
  if (!navigator.onLine) { toast(t("offlineNotice"), "error"); return; }
  try {
    await sync.createBackup();
    await alertDialog(t("backupCreated"));
  } catch (err) {
    toast(t("syncError", { message: err.message || String(err) }), "error");
  }
}

async function showBackupList() {
  if (!navigator.onLine) { toast(t("offlineNotice"), "error"); return; }
  try {
    const backups = await sync.listBackups();
    backupListEl.innerHTML = "";
    if (backups.length === 0) {
      backupListEl.classList.remove("hidden");
      backupListEl.innerHTML = `<div class="backup-list-item">${t("noBackupsFound")}</div>`;
      return;
    }
    for (const file of backups) {
      const row = document.createElement("div");
      row.className = "backup-list-item";
      row.innerHTML = `<span>${file.name}</span><span>${formatDate(file.modifiedTime)}</span>`;
      row.addEventListener("click", () => chooseRestoreMode(file));
      backupListEl.appendChild(row);
    }
    backupListEl.classList.remove("hidden");
  } catch (err) {
    toast(t("syncError", { message: err.message || String(err) }), "error");
  }
}

async function chooseRestoreMode(file) {
  const wantsReplace = await confirmDialog(
    `${t("restoreChooseMode")}\n\n${t("restoreReplace")}: ${t("restoreReplaceDesc")}\n${t("restoreMerge")}: ${t("restoreMergeDesc")}`,
    t("restoreReplace")
  );
  const mode = wantsReplace ? "replace" : "merge";
  try {
    await sync.restoreBackup(file.id, mode);
    backupListEl.classList.add("hidden");
    await alertDialog(t("backupRestored"));
    window.dispatchEvent(new CustomEvent("sm:data-changed"));
  } catch (err) {
    toast(t("syncError", { message: err.message || String(err) }), "error");
  }
}

/* ------------------------------------------------------------- export */

async function exportData(format) {
  const items = await filteredOrAllItems();
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  if (format === "json") {
    downloadBlob(new Blob([JSON.stringify(items, null, 2)], { type: "application/json" }), `second-memory-${ts}.json`);
  } else {
    downloadBlob(new Blob([toCsv(items)], { type: "text/csv" }), `second-memory-${ts}.csv`);
  }
  toast(t("exportDone"), "success");
}

async function filteredOrAllItems() {
  const { search, tags, type } = state.filters;
  if (!search && tags.length === 0 && !type) {
    return (await db.getAllItems()).filter((i) => !i.deletedAt);
  }
  const { results } = await db.queryItems({ search, tags, type, offset: 0, limit: 100000 });
  return results;
}

function toCsv(items) {
  const cols = ["id", "type", "title", "comment", "tags", "url", "filename", "pinned", "reminderAt", "createdAt", "updatedAt"];
  const lines = [cols.join(",")];
  for (const item of items) {
    const row = cols.map((c) => {
      let val = c === "tags" ? (item.tags || []).join(";") : item[c];
      val = val == null ? "" : String(val);
      if (/[",\n]/.test(val)) val = `"${val.replace(/"/g, '""')}"`;
      return val;
    });
    lines.push(row.join(","));
  }
  return lines.join("\r\n");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* -------------------------------------------------------------- print */

async function printOverview() {
  const all = await db.getAllItems();
  const live = all.filter((item) => !item.deletedAt);
  if (live.length === 0) {
    toast(t("printOverviewEmpty"), "error");
    return;
  }

  const locale = state.lang === "nl" ? "nl-NL" : "en-GB";
  const groups = TYPE_ORDER
    .map((type) => ({
      type,
      items: live
        .filter((item) => item.type === type)
        .sort((a, b) => a.title.localeCompare(b.title, locale, { sensitivity: "base" })),
    }))
    .filter((group) => group.items.length > 0);

  const groupsHtml = groups
    .map(
      (group) => `<div class="print-overview-group">
        <h2>${escapeHtml(t(TYPE_LABEL_KEYS[group.type]))} (${group.items.length})</h2>
        ${group.items.map(renderPrintOverviewItem).join("")}
      </div>`
    )
    .join("");

  printOverviewEl.innerHTML = `
    <h1 class="print-overview-title">${escapeHtml(t("printOverviewTitle"))}</h1>
    <p class="print-overview-meta">${escapeHtml(t("printOverviewMeta", { count: live.length, date: formatDate(new Date().toISOString()) }))}</p>
    ${groupsHtml}
  `;

  document.body.classList.add("printing-overview");
  window.print();
}

function renderPrintOverviewItem(item) {
  const tagsHtml = item.tags && item.tags.length > 0
    ? `<div class="print-overview-item-tags">${item.tags.map(escapeHtml).join(", ")}</div>`
    : "";
  const urlHtml = item.type === "link" && item.url
    ? `<div class="print-overview-item-meta">${escapeHtml(item.url)}</div>`
    : "";
  const commentHtml = item.comment
    ? `<div class="print-overview-item-comment">${escapeHtml(item.comment)}</div>`
    : "";
  return `<div class="print-overview-item">
    <div class="print-overview-item-title">${escapeHtml(item.title)}</div>
    ${urlHtml}
    ${tagsHtml}
    <div class="print-overview-item-meta">${escapeHtml(formatDate(item.createdAt))}</div>
    ${commentHtml}
  </div>`;
}

/* ------------------------------------------------------------ storage */

async function renderStorageInfo() {
  const persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
  const estimate = await db.getStorageEstimate();
  const parts = [persisted ? t("storagePersisted") : t("storageNotPersisted")];
  if (estimate) {
    parts.push(t("storageEstimate", { used: formatBytes(estimate.usage), quota: formatBytes(estimate.quota) }));
  }
  storageInfoEl.innerHTML = parts.map((p) => `<div>${p}</div>`).join("");
}
