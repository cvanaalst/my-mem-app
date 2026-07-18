/*
 * Second Memory — "recently deleted" view. Lists tombstoned items (which
 * the app keeps so a deletion can propagate through sync) and lets you
 * restore one. Restore is delegated to app.js, which re-creates the item
 * under a fresh id — the same trick undo-delete uses, so the lingering
 * tombstone can't re-kill the restored copy on the next sync.
 */
import { db } from "./db.js";
import { i18n } from "./i18n.js";
import { escapeHtml, formatDate } from "./ui.js";

const { t } = i18n;

const listEl = document.getElementById("trash-list");
const TYPE_LABEL_KEYS = { link: "typeLink", text: "typeText", image: "typeImage", list: "typeList", file: "typeFile" };

let onRestore = null;
let onPurge = null;

export function initTrashView(handlers) {
  onRestore = handlers.onRestore;
  onPurge = handlers.onPurge;
}

export async function refreshTrashView() {
  const items = await db.getDeletedItems();
  listEl.innerHTML = "";
  if (items.length === 0) {
    listEl.innerHTML = `<p class="trash-empty">${t("trashEmpty")}</p>`;
    return;
  }
  for (const item of items) {
    listEl.appendChild(renderRow(item));
  }
}

function renderRow(item) {
  const row = document.createElement("div");
  row.className = "trash-item";

  const info = document.createElement("div");
  info.className = "trash-item-info";
  const title = (item.title || "").trim() || t("trashUntitled");
  const typeLabel = t(TYPE_LABEL_KEYS[item.type] || "typeText");
  info.innerHTML =
    `<span class="trash-item-title">${escapeHtml(title)}</span>` +
    `<span class="trash-item-meta">${escapeHtml(typeLabel)} · ${escapeHtml(formatDate(item.deletedAt))}</span>`;

  const actions = document.createElement("div");
  actions.className = "trash-item-actions";

  const restoreBtn = document.createElement("button");
  restoreBtn.type = "button";
  restoreBtn.className = "secondary-btn trash-restore-btn";
  restoreBtn.textContent = t("restore");
  restoreBtn.addEventListener("click", async () => {
    restoreBtn.disabled = true;
    await onRestore(item);
    await refreshTrashView();
  });

  const purgeBtn = document.createElement("button");
  purgeBtn.type = "button";
  purgeBtn.className = "text-btn trash-purge-btn";
  purgeBtn.textContent = t("deleteForever");
  purgeBtn.addEventListener("click", async () => {
    purgeBtn.disabled = true;
    const done = await onPurge(item);
    if (done) await refreshTrashView();
    else purgeBtn.disabled = false;
  });

  actions.appendChild(restoreBtn);
  actions.appendChild(purgeBtn);
  row.appendChild(info);
  row.appendChild(actions);
  return row;
}
