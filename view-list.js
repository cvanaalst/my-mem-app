/*
 * Second Memory — list view: reverse-chronological item cards,
 * paginated ("load more"), respecting the shared search/tag/type filters.
 */
import { db } from "./db.js";
import { state } from "./state.js";
import { i18n } from "./i18n.js";
import { formatDate, typeIconSvg } from "./ui.js";

const { t } = i18n;

const listEl = document.getElementById("list-items");
const emptyEl = document.getElementById("list-empty");
const loadingEl = document.getElementById("list-loading");
const loadMoreBtn = document.getElementById("btn-load-more");

let onOpenItem = () => {};
let onTagClick = () => {};
let onTogglePin = () => {};

// Bumped on every resetAndLoadList() call so an in-flight query whose
// filters have since changed can detect it's stale and discard its
// results instead of clobbering a newer, more correct render — e.g. two
// filter controls (sort + date range) changing in quick succession.
let generation = 0;

export function initListView(handlers) {
  onOpenItem = handlers.onOpenItem;
  onTagClick = handlers.onTagClick || (() => {});
  onTogglePin = handlers.onTogglePin || (() => {});
  loadMoreBtn.addEventListener("click", () => loadMore());
}

export async function resetAndLoadList() {
  state.list.offset = 0;
  listEl.innerHTML = "";
  generation++;
  await loadMore(true, generation);
}

async function loadMore(replace = false, gen = generation) {
  if (!replace && state.list.loading) return;
  state.list.loading = true;
  loadingEl.classList.toggle("hidden", !replace);

  try {
    const { results, hasMore } = await db.queryItems({
      search: state.filters.search,
      tags: state.filters.tags,
      type: state.filters.type,
      sortBy: state.filters.sortBy,
      sortDir: state.filters.sortDir,
      dateFrom: state.filters.dateFrom,
      dateTo: state.filters.dateTo,
      offset: state.list.offset,
      limit: state.list.pageSize,
    });

    if (gen !== generation) return; // superseded by a newer resetAndLoadList — discard

    const hasActiveFilter = state.filters.search || state.filters.tags.length || state.filters.type
      || state.filters.dateFrom || state.filters.dateTo;
    if (replace && results.length === 0) {
      emptyEl.classList.remove("hidden");
      const msg = emptyEl.querySelector("p");
      msg.textContent = hasActiveFilter ? t("noResults") : t("emptyList");
    } else {
      emptyEl.classList.add("hidden");
    }

    for (const item of results) {
      listEl.appendChild(renderCard(item));
    }

    state.list.offset += results.length;
    loadMoreBtn.classList.toggle("hidden", !hasMore);
  } finally {
    state.list.loading = false;
    loadingEl.classList.add("hidden");
  }
}

function renderCard(item) {
  const card = document.createElement("div");
  card.className = "item-card";
  card.dataset.id = item.id;

  const iconBox = document.createElement("div");
  iconBox.className = "item-card-icon";
  iconBox.innerHTML = `<svg viewBox="0 0 24 24" class="icon">${typeIconSvg(item.type)}</svg>`;
  card.appendChild(iconBox);

  const body = document.createElement("div");
  body.className = "item-card-body";

  const title = document.createElement("p");
  title.className = "item-card-title";
  title.textContent = item.title;
  body.appendChild(title);

  if (item.comment) {
    const comment = document.createElement("p");
    comment.className = "item-card-comment";
    comment.textContent = item.comment;
    body.appendChild(comment);
  }

  if (item.tags && item.tags.length) {
    const tagsRow = document.createElement("div");
    tagsRow.className = "item-card-tags";
    for (const tag of item.tags) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = tag;
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        onTagClick(tag);
      });
      tagsRow.appendChild(chip);
    }
    body.appendChild(tagsRow);
  }

  if (item.reminderAt) {
    const today = new Date().toISOString().slice(0, 10);
    const reminder = document.createElement("span");
    reminder.className = `item-card-reminder${item.reminderAt <= today ? " due" : ""}`;
    reminder.textContent = t("reminderDue", { date: formatDateOnly(item.reminderAt) });
    body.appendChild(reminder);
  }

  const date = document.createElement("span");
  date.className = "item-card-date";
  date.textContent = formatDate(item.createdAt);
  body.appendChild(date);

  card.appendChild(body);

  const pinBtn = document.createElement("button");
  pinBtn.type = "button";
  pinBtn.className = `item-card-pin${item.pinned ? " active" : ""}`;
  pinBtn.innerHTML = '<svg viewBox="0 0 24 24" class="icon"><path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01z"/></svg>';
  pinBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    onTogglePin(item.id, !item.pinned);
  });
  card.appendChild(pinBtn);

  if (item.type === "image" && item.mediaId) {
    loadThumbnail(item.mediaId, iconBox);
  }

  card.addEventListener("click", () => onOpenItem(item.id));
  return card;
}

function formatDateOnly(dateStr) {
  try {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString(i18n.getLang() === "nl" ? "nl-NL" : "en-GB", {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch (_) {
    return dateStr;
  }
}

async function loadThumbnail(mediaId, iconBox) {
  const media = await db.getMedia(mediaId);
  if (media && media.thumbnailBlob) {
    const url = URL.createObjectURL(media.thumbnailBlob);
    iconBox.innerHTML = `<img src="${url}" alt="">`;
  }
}
