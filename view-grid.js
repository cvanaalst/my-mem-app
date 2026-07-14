/*
 * Second Memory — photo grid view + lightbox (swipe/arrow navigation).
 */
import { db } from "./db.js";
import { state } from "./state.js";

const gridEl = document.getElementById("grid-items");
const emptyEl = document.getElementById("grid-empty");

const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxClose = document.getElementById("lightbox-close");
const lightboxPrev = document.getElementById("lightbox-prev");
const lightboxNext = document.getElementById("lightbox-next");

let objectUrls = [];
let onOpenItem = () => {};

// Same staleness guard as view-list.js: discards results from a
// resetAndLoadGrid() call superseded by a newer one before it resolved.
let generation = 0;

export function initGridView(handlers) {
  onOpenItem = handlers.onOpenItem;
  lightboxClose.addEventListener("click", closeLightbox);
  lightboxPrev.addEventListener("click", () => showLightbox(state.grid.lightboxIndex - 1));
  lightboxNext.addEventListener("click", () => showLightbox(state.grid.lightboxIndex + 1));

  let touchStartX = null;
  lightbox.addEventListener("touchstart", (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
  lightbox.addEventListener("touchend", (e) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) {
      showLightbox(state.grid.lightboxIndex + (dx < 0 ? 1 : -1));
    }
    touchStartX = null;
  }, { passive: true });

  document.addEventListener("keydown", (e) => {
    if (lightbox.classList.contains("hidden")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") showLightbox(state.grid.lightboxIndex - 1);
    if (e.key === "ArrowRight") showLightbox(state.grid.lightboxIndex + 1);
  });
}

export async function resetAndLoadGrid() {
  generation++;
  const gen = generation;

  const { search, tags, type, sortBy, sortDir, dateFrom, dateTo } = state.filters;
  let images = await db.getImageItems({ sortBy, sortDir, dateFrom, dateTo });

  if (gen !== generation) return; // superseded by a newer resetAndLoadGrid — discard

  if (type && type !== "image") images = [];
  if (search) {
    const needle = db.normalizeSearchText(search);
    const words = needle.split(/\s+/).filter(Boolean);
    images = images.filter((item) => {
      const haystack = db.normalizeSearchText(`${item.title || ""} ${item.comment || ""} ${item.text || ""} ${item.url || ""}`);
      return words.every((w) => haystack.includes(w));
    });
  }
  if (tags.length) {
    images = images.filter((item) => tags.every((tg) => (item.tags || []).includes(tg)));
  }

  revokeUrls();
  gridEl.innerHTML = "";

  state.grid.images = images;
  emptyEl.classList.toggle("hidden", images.length > 0);

  for (let i = 0; i < images.length; i++) {
    const item = images[i];
    const cell = document.createElement("div");
    cell.className = "photo-grid-item";
    cell.dataset.index = String(i);
    gridEl.appendChild(cell);
    loadThumb(item, cell);
    cell.addEventListener("click", () => showLightbox(i));
  }
}

async function loadThumb(item, cell) {
  const media = await db.getMedia(item.mediaId);
  if (media && media.thumbnailBlob) {
    const url = URL.createObjectURL(media.thumbnailBlob);
    objectUrls.push(url);
    cell.innerHTML = `<img src="${url}" alt="${item.title.replace(/"/g, "&quot;")}">`;
  }
}

async function showLightbox(index) {
  const images = state.grid.images;
  if (images.length === 0) return;
  const wrapped = ((index % images.length) + images.length) % images.length;
  state.grid.lightboxIndex = wrapped;
  const item = images[wrapped];

  const media = await db.getMedia(item.mediaId);
  if (media && media.blob) {
    const url = URL.createObjectURL(media.blob);
    lightboxImg.src = url;
    lightboxImg.alt = item.title;
    lightboxImg.dataset.itemId = item.id;
    lightboxImg.onload = () => URL.revokeObjectURL(url);
  }
  lightbox.classList.remove("hidden");
}

// Tap the image itself to open the full detail/edit view.
lightboxImg.addEventListener("click", () => {
  const id = lightboxImg.dataset.itemId;
  if (id) { closeLightbox(); onOpenItem(id); }
});

function closeLightbox() {
  lightbox.classList.add("hidden");
  state.grid.lightboxIndex = -1;
}

function revokeUrls() {
  objectUrls.forEach((u) => URL.revokeObjectURL(u));
  objectUrls = [];
}
