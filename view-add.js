/*
 * Second Memory — add view: create a new item of any of the four types.
 */
import { db } from "./db.js";
import { state } from "./state.js";
import { i18n } from "./i18n.js";
import { toast, confirmDialog, setupTagInput } from "./ui.js";

const { t } = i18n;

const typeSelector = document.getElementById("add-type-selector");
const form = document.getElementById("add-form");
const titleInput = document.getElementById("add-title");
const commentInput = document.getElementById("add-comment");
const reminderInput = document.getElementById("add-reminder");
const tagsInput = document.getElementById("add-tags-input");
const tagsChips = document.getElementById("add-tags-chips");
const tagsSuggestions = document.getElementById("add-tags-suggestions");
const btnCancel = document.getElementById("btn-add-cancel");
const btnPin = document.getElementById("btn-add-pin");

const fields = {
  link: document.getElementById("add-link-field"),
  text: document.getElementById("add-text-field"),
  image: document.getElementById("add-image-field"),
  file: document.getElementById("add-file-field"),
};
const urlInput = document.getElementById("add-url");
const textInput = document.getElementById("add-text");
const imageInput = document.getElementById("add-image-input");
const imagePreview = document.getElementById("add-image-preview");
const fileInput = document.getElementById("add-file-input");
const filePreview = document.getElementById("add-file-preview");

let tagWidget = null;
let onSaved = () => {};
let onCancel = () => {};
let pinned = false;

export function initAddView(handlers) {
  onSaved = handlers.onSaved;
  onCancel = handlers.onCancel;

  typeSelector.addEventListener("click", (e) => {
    const btn = e.target.closest(".type-btn");
    if (!btn) return;
    setType(btn.dataset.type);
  });

  btnCancel.addEventListener("click", () => { resetForm(); onCancel(); });
  btnPin.addEventListener("click", () => { pinned = !pinned; renderPin(); });
  imageInput.addEventListener("change", handleImageSelect);
  fileInput.addEventListener("change", handleFileSelect);
  form.addEventListener("submit", handleSave);
}

/**
 * Opens the add form, optionally pre-filled — used both for the normal
 * "+" tab and for quick-capture via the #add hash deep-link (see app.js),
 * which is what an iOS Shortcut added to the share sheet targets since a
 * PWA itself can't register as a share-sheet destination.
 */
export async function openAdd(prefill = null) {
  resetForm();
  const allTags = (await db.getAllTags()).map((x) => x.tag);
  tagWidget = setupTagInput(tagsInput, tagsChips, tagsSuggestions, prefill?.tags || []);
  tagWidget.renderSuggestions(allTags);
  tagsInput.oninput = () => tagWidget.renderSuggestions(allTags);

  if (prefill) {
    if (prefill.type) setType(prefill.type);
    if (prefill.url) urlInput.value = prefill.url;
    if (prefill.text) textInput.value = prefill.text;
    if (prefill.title) titleInput.value = prefill.title;
    if (prefill.comment) commentInput.value = prefill.comment;
  }
}

function resetForm() {
  form.reset();
  imagePreview.classList.add("hidden");
  imagePreview.innerHTML = "";
  filePreview.classList.add("hidden");
  filePreview.innerHTML = "";
  state.addImageFile = null;
  state.addFileFile = null;
  pinned = false;
  renderPin();
  setType("link");
}

function renderPin() {
  btnPin.classList.toggle("active", pinned);
}

function setType(type) {
  state.addType = type;
  typeSelector.querySelectorAll(".type-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.type === type);
  });
  Object.entries(fields).forEach(([key, el]) => el.classList.toggle("hidden", key !== type));
}

function handleImageSelect() {
  const file = imageInput.files[0];
  if (!file) return;
  state.addImageFile = file;
  const url = URL.createObjectURL(file);
  imagePreview.innerHTML = `<img src="${url}" alt="">`;
  imagePreview.classList.remove("hidden");
  if (!titleInput.value) titleInput.value = file.name.replace(/\.[^.]+$/, "");
}

function handleFileSelect() {
  const file = fileInput.files[0];
  if (!file) return;
  const sizeMb = file.size / (1024 * 1024);
  if (sizeMb > 10) {
    const proceed = confirm(t("fileTooLargeWarning", { size: sizeMb.toFixed(1) }));
    if (!proceed) { fileInput.value = ""; return; }
  }
  state.addFileFile = file;
  filePreview.innerHTML = `${escapeName(file.name)} (${(sizeMb).toFixed(2)} MB)`;
  filePreview.classList.remove("hidden");
  if (!titleInput.value) titleInput.value = file.name.replace(/\.[^.]+$/, "");
}

async function handleSave(e) {
  e.preventDefault();
  if (!titleInput.value.trim()) { toast(t("titleRequired"), "error"); return; }

  const type = state.addType;
  if (type === "image" && !state.addImageFile) { toast(t("fieldImage"), "error"); return; }
  if (type === "file" && !state.addFileFile) { toast(t("fieldFile"), "error"); return; }

  if (type === "link") {
    const dup = await db.findDuplicateLink(urlInput.value.trim());
    if (dup) {
      const proceed = await confirmDialog(t("duplicateLinkMessage", { title: dup.title }), t("saveAnyway"));
      if (!proceed) return;
    }
  }

  const now = new Date().toISOString();
  const item = {
    id: makeId(),
    type,
    title: titleInput.value.trim(),
    comment: commentInput.value.trim(),
    tags: tagWidget.getTags(),
    pinned,
    reminderAt: reminderInput.value || null,
    url: null, text: null, mediaId: null, filename: null, mimeType: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  if (type === "link") {
    item.url = urlInput.value.trim();
  } else if (type === "text") {
    item.text = textInput.value;
  } else if (type === "image") {
    const file = state.addImageFile;
    const fullBlob = await db.makeFullImage(file);
    const thumbBlob = await db.makeThumbnail(file);
    const mediaId = makeId();
    await db.putMedia({ id: mediaId, blob: fullBlob, thumbnailBlob: thumbBlob });
    item.mediaId = mediaId;
    item.filename = file.name;
    item.mimeType = "image/jpeg";
  } else if (type === "file") {
    const file = state.addFileFile;
    const mediaId = makeId();
    await db.putMedia({ id: mediaId, blob: file, thumbnailBlob: null });
    item.mediaId = mediaId;
    item.filename = file.name;
    item.mimeType = file.type || "application/octet-stream";
  }

  await db.putItem(item);
  toast(t("itemSaved"), "success");
  resetForm();
  onSaved();
}

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function escapeName(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
