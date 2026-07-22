/*
 * Second Memory — sync/backup/restore activity log view. A local-only diary
 * (see db.logActivity) so the user can see what actually happened and why
 * auto-sync may have skipped (e.g. the Google token expired ~1h after login).
 */
import { db } from "./db.js";
import { i18n } from "./i18n.js";
import { escapeHtml, formatDate, confirmDialog } from "./ui.js";

const { t } = i18n;

const listEl = document.getElementById("activity-list");

const KIND_KEYS = { sync: "logKindSync", backup: "logKindBackup", restore: "logKindRestore", autosync: "logKindAutosync" };
const OUTCOME_KEYS = { success: "logOk", error: "logError", skipped: "logSkipped" };

export async function refreshActivityView() {
  const entries = await db.getActivityLog();
  listEl.innerHTML = "";
  if (entries.length === 0) {
    listEl.innerHTML = `<p class="trash-empty">${t("activityEmpty")}</p>`;
    return;
  }
  for (const e of entries) {
    listEl.appendChild(renderRow(e));
  }
}

function renderRow(e) {
  const row = document.createElement("div");
  row.className = `activity-item activity-${e.outcome}`;

  const dot = document.createElement("span");
  dot.className = `activity-dot activity-dot-${e.outcome}`;
  dot.setAttribute("aria-hidden", "true");

  const body = document.createElement("div");
  body.className = "activity-body";
  const kind = t(KIND_KEYS[e.kind] || "logKindSync");
  const outcome = t(OUTCOME_KEYS[e.outcome] || "logOk");
  const detail = e.detail ? ` · ${escapeHtml(e.detail)}` : "";
  body.innerHTML =
    `<span class="activity-headline">${escapeHtml(kind)} · ${escapeHtml(outcome)}${detail}</span>` +
    `<span class="activity-time">${escapeHtml(formatDate(e.at))}</span>`;

  row.appendChild(dot);
  row.appendChild(body);
  return row;
}

export function initActivityView() {
  const clearBtn = document.getElementById("btn-activity-clear");
  clearBtn.addEventListener("click", async () => {
    const ok = await confirmDialog(t("activityClear") + "?", t("activityClear"));
    if (!ok) return;
    await db.clearActivityLog();
    await refreshActivityView();
  });
}
