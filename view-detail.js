/*
 * Second Memory — detail/edit view: view & edit an item, delete
 * (tombstone), share out.
 */
import { db } from "./db.js";
import { state } from "./state.js";
import { i18n } from "./i18n.js";
import { toast, confirmDialog, formatDate, setupTagInput, openInNewTab, openBlobInNewTab, openTabForAsyncBlob, autoGrowTextarea } from "./ui.js";
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

const PENCIL_ICON = '<svg viewBox="0 0 24 24" class="icon"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
const EYE_ICON = '<svg viewBox="0 0 24 24" class="icon"><path d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 12a5 5 0 110-10 5 5 0 010 10zm0-8a3 3 0 100 6 3 3 0 000-6z"/></svg>';

let tagWidget = null;
let commentGrow = null;
let currentItem = null;
let currentAllTags = [];
let pinned = false;
let textViewMode = "rendered"; // "rendered" | "edit" — text items only
let onClose = () => {};
let onChanged = () => {};
let onDelete = async () => {};

export function initDetailView(handlers) {
  onClose = handlers.onClose;
  onDelete = handlers.onDelete;
  onChanged = handlers.onChanged;

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

  btnBack.addEventListener("click", onClose);
  btnDelete.addEventListener("click", handleDelete);
  btnPrint.addEventListener("click", () => window.print());
  btnShare.addEventListener("click", handleShare);
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
}

function renderPin() {
  btnPin.classList.toggle("active", pinned);
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
    btnTextMode.innerHTML = EYE_ICON;
    btnTextMode.setAttribute("aria-label", t("previewText"));
  } else {
    textRendered.innerHTML = renderMarkdown(textInput.value);
    textRendered.classList.remove("hidden");
    textInput.classList.add("hidden");
    btnTextMode.innerHTML = PENCIL_ICON;
    btnTextMode.setAttribute("aria-label", t("editText"));
  }
}

export async function openDetail(id) {
  const item = await db.getItem(id);
  if (!item) { toast(t("noResults"), "error"); onClose(); return; }
  currentItem = item;
  state.detailItemId = id;

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
  urlInput.value = item.type === "link" ? (item.url || "") : "";
  textInput.value = item.type === "text" ? (item.text || "") : "";
  if (item.type === "text") {
    textViewMode = "rendered";
    renderTextMode();
  }

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
    mediaBox.innerHTML = `<div class="file-preview">${escapeName(item.filename || item.title)}</div>`;
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
    updatedAt: new Date().toISOString(),
  };
  if (currentItem.type === "link") updated.url = urlInput.value.trim();
  if (currentItem.type === "text") updated.text = textInput.value;

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

async function handleShare() {
  const item = currentItem;
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

function escapeName(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

