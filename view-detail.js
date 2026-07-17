/*
 * Second Memory — detail/edit view: view & edit an item, delete
 * (tombstone), share out.
 */
import { db } from "./db.js";
import { state } from "./state.js";
import { i18n } from "./i18n.js";
import { toast, confirmDialog, formatDate, setupTagInput, setupChecklist, openInNewTab, openBlobInNewTab, openTabForAsyncBlob, autoGrowTextarea, escapeHtml, trapFocus } from "./ui.js";
import { icons, typeIconSvg } from "./icons.js";
import { renderMarkdown } from "./markdown.js";

const { t } = i18n;

const form = document.getElementById("detail-form");
const mediaBox = document.getElementById("detail-media");
const btnOpenMedia = document.getElementById("btn-detail-open-media");
const openMediaLabelEl = document.getElementById("detail-open-media-label");
const titleInput = document.getElementById("detail-title");
const linkField = document.getElementById("detail-link-field");
const urlInput = document.getElementById("detail-url");
const btnOpenUrl = document.getElementById("btn-detail-open-url");
const textField = document.getElementById("detail-text-field");
const textInput = document.getElementById("detail-text");
const textRendered = document.getElementById("detail-text-rendered");
const listField = document.getElementById("detail-list-field");
const listContainer = document.getElementById("detail-list");
const btnOpenText = document.getElementById("btn-detail-open-text");
const btnTextMode = document.getElementById("btn-detail-text-mode");
const commentInput = document.getElementById("detail-comment");
const reminderInput = document.getElementById("detail-reminder");
const tagsInput = document.getElementById("detail-tags-input");
const tagsChips = document.getElementById("detail-tags-chips");
const tagsSuggestions = document.getElementById("detail-tags-suggestions");
const createdEl = document.getElementById("detail-created");
const updatedEl = document.getElementById("detail-updated");
const btnBack = document.getElementById("btn-detail-back");
const btnDelete = document.getElementById("btn-detail-delete");
const btnShare = document.getElementById("btn-detail-share");
const btnPin = document.getElementById("btn-detail-pin");
const btnPrint = document.getElementById("btn-detail-print");
const linksChips = document.getElementById("detail-links-chips");
const btnAddLink = document.getElementById("btn-detail-add-link");
const backlinksSection = document.getElementById("detail-backlinks-section");
const backlinksChips = document.getElementById("detail-backlinks-chips");
const linkPickerDialog = document.getElementById("link-picker-dialog");
const linkPickerSearch = document.getElementById("link-picker-search");
const linkPickerResults = document.getElementById("link-picker-results");
const linkPickerCancel = document.getElementById("link-picker-cancel");

let tagWidget = null;
let listWidget = null;
let commentGrow = null;
let currentItem = null;
let currentAllTags = [];
let pinned = false;
let textViewMode = "rendered"; // "rendered" | "edit" — text items only
let linkedItems = []; // [{id, title, type}] — resolved from item.linkedIds on open
let releaseLinkPickerFocus = null;
let onClose = () => {};
let onChanged = () => {};
let onDelete = async () => {};
let onNavigate = () => {};

export function initDetailView(handlers) {
  onClose = handlers.onClose;
  onDelete = handlers.onDelete;
  onChanged = handlers.onChanged;
  onNavigate = handlers.onNavigate;

  // Created once, here — NOT inside openDetail(), which runs every time a
  // different item is opened. setupTagInput() attaches keydown/blur
  // listeners to the (persistent, never-recreated) tags input; calling it
  // again on every open stacked up duplicate listeners, each holding its
  // own stale copy of whatever item's tags were being edited at the time.
  // That's what caused an earlier item's tags to bleed into a new one and
  // made removing a tag look broken — a leftover listener from a
  // previous item would re-render its own old list right after yours
  // ran. Resetting via tagWidget.setTags() on each open reuses the same
  // listeners instead of adding new ones.
  tagWidget = setupTagInput(tagsInput, tagsChips, tagsSuggestions, []);
  tagsInput.addEventListener("input", () => tagWidget.renderSuggestions(currentAllTags));
  commentGrow = autoGrowTextarea(commentInput);

  // Ticking a checkbox — or setting/removing a row's link — persists
  // immediately: a shopping list you tick, or a row you link then tap
  // through, must stick without hitting Save. Row text add/edit/delete
  // still ride the Save button like every other field.
  //   pickLink  -> opens the shared picker, resolves with the chosen id
  //   onNavigate-> tapping a linked row opens that entry (persist first so
  //                the freshly-set link and any pending edits aren't lost)
  listWidget = setupChecklist(listContainer, {
    onPersist: persistListItems,
    pickLink: () => pickLinkTarget(),
    onNavigate: async (linkedId) => {
      await persistListItems(listWidget.getItems());
      onNavigate(linkedId);
    },
  });

  btnBack.addEventListener("click", onClose);
  btnDelete.addEventListener("click", handleDelete);
  btnPrint.addEventListener("click", () => window.print());
  btnShare.addEventListener("click", () => shareItem(currentItem));
  btnPin.addEventListener("click", () => { pinned = !pinned; renderPin(); });
  btnTextMode.addEventListener("click", () => {
    textViewMode = textViewMode === "rendered" ? "edit" : "rendered";
    renderTextMode();
  });
  btnOpenUrl.addEventListener("click", () => {
    const url = urlInput.value.trim();
    if (!url) { toast(t("noUrlToOpen"), "default"); return; }
    openInNewTab(url);
  });
  btnOpenText.addEventListener("click", () => {
    const blob = new Blob([textInput.value], { type: "text/markdown" });
    openBlobInNewTab(blob);
  });
  btnOpenMedia.addEventListener("click", handleOpenMedia);
  form.addEventListener("submit", handleSave);

  btnAddLink.addEventListener("click", openItemLinkPicker);
  linkPickerCancel.addEventListener("click", closeLinkPicker);
  linkPickerSearch.addEventListener("input", () => renderLinkPickerResults(linkPickerSearch.value.trim()));
}

function renderPin() {
  btnPin.classList.toggle("active", pinned);
}

/**
 * Linked items are directional (this item points at others) but shown
 * bidirectionally: the "Linked items" row is editable state staged here
 * and only persisted on Opslaan, same as tags. The "Linked from" row
 * below it is read-only and computed fresh from the DB on every open
 * (db.getBacklinks), so it can never go stale relative to what other
 * items actually point here.
 */
function renderLinks() {
  linksChips.innerHTML = "";
  for (const link of linkedItems) {
    const chip = document.createElement("span");
    chip.className = "chip removable";
    chip.innerHTML = `<span>${escapeHtml(link.title)}</span><span class="chip-remove">&times;</span>`;
    chip.querySelector("span").addEventListener("click", () => onNavigate(link.id));
    chip.querySelector(".chip-remove").addEventListener("click", (e) => {
      e.stopPropagation();
      linkedItems = linkedItems.filter((x) => x.id !== link.id);
      renderLinks();
    });
    linksChips.appendChild(chip);
  }
}

function renderBacklinks(backlinks) {
  backlinksSection.classList.toggle("hidden", backlinks.length === 0);
  backlinksChips.innerHTML = "";
  for (const item of backlinks) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = item.title;
    chip.addEventListener("click", () => onNavigate(item.id));
    backlinksChips.appendChild(chip);
  }
}

// The picker is shared by item-level linking ("Koppeling toevoegen") and
// per-row checklist links, so its behaviour is passed in: `pickerExclude`
// hides ids that shouldn't be offered, and `pickerOnPick(item)` runs when a
// result is chosen.
let pickerExclude = new Set();
let pickerOnPick = () => {};
let pickerOnClose = null;

function openLinkPicker(opts = {}) {
  pickerExclude = opts.excludeIds || new Set();
  pickerOnPick = opts.onPick || (() => {});
  pickerOnClose = opts.onClose || null;
  linkPickerSearch.value = "";
  linkPickerDialog.classList.remove("hidden");
  releaseLinkPickerFocus = trapFocus(linkPickerDialog, closeLinkPicker);
  linkPickerSearch.focus(); // prefer the search field over the trap's first control
  renderLinkPickerResults("");
}

function closeLinkPicker() {
  if (releaseLinkPickerFocus) { releaseLinkPickerFocus(); releaseLinkPickerFocus = null; }
  linkPickerDialog.classList.add("hidden");
  const cb = pickerOnClose;
  pickerOnClose = null;
  if (cb) cb(); // resolves pickLinkTarget with undefined when dismissed
}

async function renderLinkPickerResults(query) {
  const { results } = await db.queryItems({ search: query, limit: 50 });
  const candidates = results.filter((item) => !pickerExclude.has(item.id));

  linkPickerResults.innerHTML = "";
  if (candidates.length === 0) {
    linkPickerResults.innerHTML = `<p class="link-picker-empty">${escapeHtml(t("linkPickerEmpty"))}</p>`;
    return;
  }
  for (const item of candidates) {
    const row = document.createElement("div");
    row.className = "link-picker-result-row";
    row.innerHTML = `<svg viewBox="0 0 24 24" class="icon">${typeIconSvg(item.type)}</svg><span>${escapeHtml(item.title)}</span>`;
    row.addEventListener("click", () => {
      // Deliver the pick before closing — closeLinkPicker() fires the
      // onClose callback (which resolves pickLinkTarget with undefined),
      // so onPick must win first.
      const onPick = pickerOnPick;
      pickerOnPick = () => {};
      onPick(item);
      closeLinkPicker();
    });
    linkPickerResults.appendChild(row);
  }
}

// Item-level "Koppeling toevoegen": add the chosen entry to this item's links.
function openItemLinkPicker() {
  openLinkPicker({
    excludeIds: new Set([currentItem.id, ...linkedItems.map((x) => x.id)]),
    onPick: (item) => {
      linkedItems.push({ id: item.id, title: item.title, type: item.type });
      renderLinks();
    },
  });
}

// Promise wrapper for the checklist: resolves with the picked id, or
// undefined if the picker is dismissed without a choice.
function pickLinkTarget() {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (v) => { if (!settled) { settled = true; resolve(v); } };
    openLinkPicker({
      excludeIds: new Set([currentItem.id]),
      onPick: (item) => finish(item.id),
      onClose: () => finish(undefined),
    });
  });
}

/**
 * Text items default to a rendered (read-only) Markdown view; tapping
 * the pencil switches to the raw textarea for editing, and tapping the
 * eye switches back — re-rendering from whatever's currently in the
 * textarea, so live edits show up in the preview immediately.
 */
function renderTextMode() {
  if (textViewMode === "edit") {
    textRendered.classList.add("hidden");
    textInput.classList.remove("hidden");
    btnTextMode.innerHTML = icons.eye;
    btnTextMode.setAttribute("aria-label", t("previewText"));
  } else {
    textRendered.innerHTML = renderMarkdown(textInput.value);
    textRendered.classList.remove("hidden");
    textInput.classList.add("hidden");
    btnTextMode.innerHTML = icons.pencil;
    btnTextMode.setAttribute("aria-label", t("editText"));
  }
}

export async function openDetail(id) {
  const item = await db.getItem(id);
  if (!item) { toast(t("noResults"), "error"); onClose(); return; }
  currentItem = item;
  state.detailItemId = id;
  closeLinkPicker();

  titleInput.value = item.title || "";
  commentInput.value = item.comment || "";
  commentGrow.resize();
  reminderInput.value = item.reminderAt || "";
  pinned = !!item.pinned;
  renderPin();
  createdEl.textContent = t("dateCreated", { date: formatDate(item.createdAt) });
  updatedEl.textContent = t("dateUpdated", { date: formatDate(item.updatedAt) });

  linkField.classList.toggle("hidden", item.type !== "link");
  textField.classList.toggle("hidden", item.type !== "text");
  listField.classList.toggle("hidden", item.type !== "list");
  urlInput.value = item.type === "link" ? (item.url || "") : "";
  textInput.value = item.type === "text" ? (item.text || "") : "";
  if (item.type === "text") {
    textViewMode = "rendered";
    renderTextMode();
  }
  // Drop row links whose target no longer exists, mirroring how item-level
  // links are cleaned at render (not persisted until the next Save).
  const listRows = item.type === "list" ? await withLiveRowLinks(item.listItems || []) : [];
  listWidget.setItems(listRows);

  mediaBox.classList.add("hidden");
  mediaBox.innerHTML = "";
  if (item.type === "image" && item.mediaId) {
    const media = await db.getMedia(item.mediaId);
    if (media && media.blob) {
      const url = URL.createObjectURL(media.blob);
      mediaBox.innerHTML = `<img src="${url}" alt="">`;
      mediaBox.classList.remove("hidden");
    }
  } else if (item.type === "file") {
    mediaBox.innerHTML = `<div class="file-preview">${escapeHtml(item.filename || item.title)}</div>`;
    mediaBox.classList.remove("hidden");
  }

  if (item.type === "image" && item.mediaId) {
    openMediaLabelEl.textContent = t("openFullSize");
    btnOpenMedia.classList.remove("hidden");
  } else if (item.type === "file" && item.mediaId) {
    openMediaLabelEl.textContent = t("openFile");
    btnOpenMedia.classList.remove("hidden");
  } else {
    btnOpenMedia.classList.add("hidden");
  }

  tagWidget.setTags(item.tags || []);
  currentAllTags = (await db.getRecentTags()).map((x) => x.tag);
  tagWidget.renderSuggestions(currentAllTags);

  // Resolved fresh from the DB on every open — silently drops ids for
  // items that were deleted since this item last linked to them, rather
  // than persisting a cleanup write on every delete elsewhere.
  const resolvedLinks = await Promise.all((item.linkedIds || []).map((linkedId) => db.getItem(linkedId)));
  linkedItems = resolvedLinks
    .filter((linked) => linked && !linked.deletedAt)
    .map((linked) => ({ id: linked.id, title: linked.title, type: linked.type }));
  renderLinks();

  renderBacklinks(await db.getBacklinks(item.id));
}

/**
 * Write an immediate list change (checkbox tick, or a row link set/removed)
 * straight through, without waiting for Save. Merges only the listItems
 * (and updatedAt) onto whatever's in the DB, so it doesn't clobber a
 * concurrent edit, and refreshes the list card's progress. currentItem is
 * kept in sync so a later Save doesn't revert it.
 */
/** Returns a copy of the rows with linkedIds cleared where the target no
 *  longer exists (or is tombstoned), so a dead link stops showing as one. */
async function withLiveRowLinks(listItems) {
  return Promise.all((listItems || []).map(async (row) => {
    if (!row.linkedId) return row;
    const target = await db.getItem(row.linkedId);
    return (target && !target.deletedAt) ? row : { ...row, linkedId: null };
  }));
}

async function persistListItems(items) {
  if (!currentItem || currentItem.type !== "list") return;
  const fresh = (await db.getItem(currentItem.id)) || currentItem;
  const updated = { ...fresh, listItems: items, updatedAt: new Date().toISOString() };
  currentItem = updated;
  await db.putItem(updated);
  onChanged();
}

async function handleSave(e) {
  e.preventDefault();
  if (!titleInput.value.trim()) { toast(t("titleRequired"), "error"); return; }

  if (currentItem.type === "link") {
    const dup = await db.findDuplicateLink(urlInput.value.trim(), currentItem.id);
    if (dup) {
      const proceed = await confirmDialog(t("duplicateLinkMessage", { title: dup.title }), t("saveAnyway"));
      if (!proceed) return;
    }
  }

  const updated = {
    ...currentItem,
    title: titleInput.value.trim(),
    comment: commentInput.value.trim(),
    tags: tagWidget.getTags(),
    pinned,
    reminderAt: reminderInput.value || null,
    linkedIds: linkedItems.map((x) => x.id),
    updatedAt: new Date().toISOString(),
  };
  if (currentItem.type === "link") updated.url = urlInput.value.trim();
  if (currentItem.type === "text") updated.text = textInput.value;
  if (currentItem.type === "list") updated.listItems = listWidget.getItems();

  await db.putItem(updated);
  toast(t("itemUpdated"), "success");
  onChanged();
  onClose();
}

async function handleDelete() {
  const item = currentItem;
  onClose();
  await onDelete(item);
}

async function handleOpenMedia() {
  const item = currentItem;
  if (!item.mediaId) return;
  // Open the tab synchronously first (see openTabForAsyncBlob) — the
  // IndexedDB read below is async, and Safari silently blocks
  // window.open() called after an await with no error to catch.
  const resolveTab = openTabForAsyncBlob();
  const media = await db.getMedia(item.mediaId);
  resolveTab(media?.blob || null);
}

/** Share (or copy) an item — used by the Detail view's Share button and by
 *  the list's long-press context menu, so both behave identically. */
export async function shareItem(item) {
  try {
    if (item.type === "link" && item.url) {
      await shareOrCopy({ title: item.title, url: item.url }, item.url);
    } else if (item.type === "text") {
      await shareOrCopy({ title: item.title, text: item.text || "" }, item.text || "");
    } else if ((item.type === "image" || item.type === "file") && item.mediaId) {
      const media = await db.getMedia(item.mediaId);
      const blob = media?.blob;
      const file = blob ? new File([blob], item.filename || item.title, { type: item.mimeType || blob.type }) : null;
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: item.title });
      } else {
        toast(t("shareNotSupported"), "default");
      }
    }
  } catch (err) {
    if (err.name !== "AbortError") toast(String(err.message || err), "error");
  }
}

async function shareOrCopy(shareData, clipboardFallback) {
  if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
    await navigator.share(shareData);
  } else if (navigator.clipboard) {
    await navigator.clipboard.writeText(clipboardFallback);
    toast(t("copiedToClipboard"), "success");
  } else {
    toast(t("shareNotSupported"), "error");
  }
}

