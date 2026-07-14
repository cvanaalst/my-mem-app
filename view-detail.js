/*
 * Second Memory — detail/edit view: view & edit an item, delete
 * (tombstone), share out.
 */
import { db } from "./db.js";
import { state } from "./state.js";
import { i18n } from "./i18n.js";
import { toast, confirmDialog, formatDate, setupTagInput, openInNewTab, openBlobInNewTab } from "./ui.js";

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
const btnOpenText = document.getElementById("btn-detail-open-text");
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

let tagWidget = null;
let currentItem = null;
let pinned = false;
let onClose = () => {};
let onChanged = () => {};

export function initDetailView(handlers) {
  onClose = handlers.onClose;
  onChanged = handlers.onChanged;

  btnBack.addEventListener("click", onClose);
  btnDelete.addEventListener("click", handleDelete);
  btnShare.addEventListener("click", handleShare);
  btnPin.addEventListener("click", () => { pinned = !pinned; renderPin(); });
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

export async function openDetail(id) {
  const item = await db.getItem(id);
  if (!item) { toast(t("noResults"), "error"); onClose(); return; }
  currentItem = item;
  state.detailItemId = id;

  titleInput.value = item.title || "";
  commentInput.value = item.comment || "";
  reminderInput.value = item.reminderAt || "";
  pinned = !!item.pinned;
  renderPin();
  createdEl.textContent = t("dateCreated", { date: formatDate(item.createdAt) });
  updatedEl.textContent = t("dateUpdated", { date: formatDate(item.updatedAt) });

  linkField.classList.toggle("hidden", item.type !== "link");
  textField.classList.toggle("hidden", item.type !== "text");
  urlInput.value = item.type === "link" ? (item.url || "") : "";
  textInput.value = item.type === "text" ? (item.text || "") : "";

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

  tagWidget = setupTagInput(tagsInput, tagsChips, tagsSuggestions, item.tags || []);
  const allTags = (await db.getAllTags()).map((x) => x.tag);
  tagWidget.renderSuggestions(allTags);
  tagsInput.addEventListener("input", () => tagWidget.renderSuggestions(allTags));
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
  const ok = await confirmDialog(t("confirmDeleteMessage"), t("delete"));
  if (!ok) return;

  const tombstoned = { ...currentItem, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await db.putItem(tombstoned);
  if (currentItem.mediaId) {
    await db.deleteMedia(currentItem.mediaId);
  }
  toast(t("itemDeleted"), "success");
  onChanged();
  onClose();
}

async function handleOpenMedia() {
  const item = currentItem;
  if (!item.mediaId) return;
  const media = await db.getMedia(item.mediaId);
  if (!media || !media.blob) return;
  openBlobInNewTab(media.blob);
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

