/*
 * Second Memory — settings view: sync, backup/restore, export, theme,
 * language, storage info.
 */
import { db } from "./db.js";
import { state } from "./state.js";
import { i18n } from "./i18n.js";
import { toast, confirmDialog, formatDate, formatBytes } from "./ui.js";
import { sync } from "./sync.js";

const { t } = i18n;

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
const storageInfoEl = document.getElementById("storage-info");

let onThemeChange = () => {};
let onLangChange = () => {};

export function initSettingsView(handlers) {
  onThemeChange = handlers.onThemeChange;
  onLangChange = handlers.onLangChange;

  btnSyncNow.addEventListener("click", runSync);
  toggleAutosync.addEventListener("change", () => {
    db.setMeta("autoSyncOnLaunch", toggleAutosync.checked);
  });
  btnBackup.addEventListener("click", runBackup);
  btnRestore.addEventListener("click", showBackupList);
  btnExportJson.addEventListener("click", () => exportData("json"));
  btnExportCsv.addEventListener("click", () => exportData("csv"));

  themeSelector.addEventListener("click", (e) => {
    const btn = e.target.closest(".theme-swatch");
    if (!btn) return;
    onThemeChange(btn.dataset.theme);
    highlightTheme(btn.dataset.theme);
  });

  selectLanguage.addEventListener("change", () => onLangChange(selectLanguage.value));

  sync.onStatusChange(renderSyncStatus);
}

export async function refreshSettingsView() {
  toggleAutosync.checked = await db.getMeta("autoSyncOnLaunch", true);
  selectLanguage.value = state.lang;
  highlightTheme(state.theme);
  await renderLastSync();
  await renderStorageInfo();
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
    toast(t("backupCreated"), "success");
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
    toast(t("backupRestored"), "success");
    backupListEl.classList.add("hidden");
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
  const cols = ["id", "type", "title", "comment", "tags", "url", "filename", "createdAt", "updatedAt"];
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
