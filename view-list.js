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
let onSwipeDelete = () => {};
let linkedIdSet = new Set();

// Bumped on every resetAndLoadList() call so an in-flight query whose
// filters have since changed can detect it's stale and discard its
// results instead of clobbering a newer, more correct render — e.g. two
// filter controls (sort + date range) changing in quick succession.
let generation = 0;

export function initListView(handlers) {
  onOpenItem = handlers.onOpenItem;
  onTagClick = handlers.onTagClick || (() => {});
  onTogglePin = handlers.onTogglePin || (() => {});
  onSwipeDelete = handlers.onSwipeDelete || (() => {});
  loadMoreBtn.addEventListener("click", () => loadMore());
}

export async function resetAndLoadList() {
  state.list.offset = 0;
  listEl.innerHTML = "";
  generation++;
  // Computed once per reset rather than per card — same one-full-scan
  // trade-off as getRecentTags()/getAllTags(), fine at personal scale.
  linkedIdSet = await db.getLinkedIdSet();
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
  const compact = state.listDensity === "compact";
  card.className = `item-card${compact ? " compact" : ""}`;
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

  // Compact rows show just the icon, title, and pin — everything else
  // (comment, tags, reminder, date) is what makes "comfortable" cards
  // taller, so it's exactly what compact mode drops.
  if (!compact) {
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
  }

  card.appendChild(body);

  const actions = document.createElement("div");
  actions.className = "item-card-actions";

  if (linkedIdSet.has(item.id)) {
    const linkBadge = document.createElement("span");
    linkBadge.className = "item-card-link-badge";
    linkBadge.setAttribute("aria-label", t("hasLinkedItems"));
    linkBadge.innerHTML = '<svg viewBox="0 0 24 24" class="icon"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>';
    actions.appendChild(linkBadge);
  }

  const pinBtn = document.createElement("button");
  pinBtn.type = "button";
  pinBtn.className = `item-card-pin${item.pinned ? " active" : ""}`;
  pinBtn.innerHTML = '<svg viewBox="0 0 24 24" class="icon"><path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01z"/></svg>';
  pinBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    onTogglePin(item.id, !item.pinned);
  });
  actions.appendChild(pinBtn);

  card.appendChild(actions);

  if (item.type === "image" && item.mediaId) {
    loadThumbnail(item.mediaId, iconBox);
  }

  attachSwipe(card, item);
  return card;
}

/**
 * Swipe-left deletes (via the same undo flow as the Detail view's Delete
 * button), swipe-right toggles pin. Threshold-triggered rather than a
 * persistent reveal-buttons drag, matching the same touch-threshold
 * pattern already used for the photo lightbox's swipe navigation.
 * Distinguishes from vertical list scrolling by bailing out as soon as
 * a gesture reads as more vertical than horizontal.
 */
function attachSwipe(card, item) {
  const THRESHOLD = 72;
  let startX = null;
  let startY = null;
  let dx = 0;
  let active = false;
  let dragged = false;

  card.style.touchAction = "pan-y";

  card.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    active = true;
    dragged = false;
    card.style.transition = "none";
  }, { passive: true });

  card.addEventListener("touchmove", (e) => {
    if (!active || startX === null) return;
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    const deltaX = x - startX;
    const deltaY = y - startY;
    if (!dragged && Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
      // Reads as a vertical scroll, not a swipe — let it scroll normally.
      active = false;
      card.style.transform = "";
      card.style.opacity = "";
      return;
    }
    dx = deltaX;
    if (Math.abs(dx) > 8) dragged = true;
    const clamped = Math.max(-110, Math.min(110, dx));
    card.style.transform = `translateX(${clamped}px)`;
    card.style.opacity = String(1 - Math.min(Math.abs(clamped) / 260, 0.35));
  }, { passive: true });

  card.addEventListener("touchend", () => {
    if (!active) { startX = null; return; }
    active = false;
    card.style.transition = "transform 0.2s ease, opacity 0.2s ease";
    if (dx <= -THRESHOLD) {
      card.style.transform = "translateX(-100%)";
      card.style.opacity = "0";
      setTimeout(() => onSwipeDelete(item), 160);
    } else if (dx >= THRESHOLD) {
      card.style.transform = "translateX(0)";
      card.style.opacity = "1";
      onTogglePin(item.id, !item.pinned);
    } else {
      card.style.transform = "translateX(0)";
      card.style.opacity = "1";
    }
    startX = null;
    dx = 0;
  });

  card.addEventListener("click", (e) => {
    if (dragged) {
      e.preventDefault();
      e.stopPropagation();
      dragged = false;
      return;
    }
    onOpenItem(item.id);
  });
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
