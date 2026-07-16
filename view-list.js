/*
 * Second Memory — list view: reverse-chronological item cards,
 * paginated ("load more"), respecting the shared search/tag/type filters.
 */
import { db } from "./db.js";
import { state } from "./state.js";
import { i18n } from "./i18n.js";
import { formatDate } from "./ui.js";
import { icons, typeIconSvg } from "./icons.js";

const { t } = i18n;

const listEl = document.getElementById("list-items");
const emptyEl = document.getElementById("list-empty");
const loadingEl = document.getElementById("list-loading");
const loadMoreBtn = document.getElementById("btn-load-more");

let onOpenItem = () => {};
let onTagClick = () => {};
let onTogglePin = () => {};
let onSwipeDelete = () => {};
let onLongPress = () => {};
let linkedIdSet = new Set();

// How many cards get the staggered entrance before it snaps to instant.
const STAGGER_LIMIT = 12;

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
  onLongPress = handlers.onLongPress || (() => {});
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
  if (replace) showSkeletons();

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

    // Stagger the entrance of a fresh page of cards. Only the first
    // handful are delayed — beyond that the cascade stops being charming
    // and starts feeling like lag — and only on a replace, so "load more"
    // appends don't re-animate the rows already on screen.
    results.forEach((item, i) => {
      const card = renderCard(item);
      if (replace && i < STAGGER_LIMIT) {
        card.classList.add("card-enter");
        card.style.setProperty("--enter-delay", `${i * 20}ms`);
      }
      listEl.appendChild(card);
    });

    state.list.offset += results.length;
    loadMoreBtn.classList.toggle("hidden", !hasMore);
  } finally {
    state.list.loading = false;
    hideSkeletons();
  }
}

/**
 * Skeletons only appear if the query is slow enough to be worth covering
 * (>150ms); a local IndexedDB read is usually far quicker than that, and a
 * skeleton that flashes for one frame reads as a glitch, not as progress.
 */
let skeletonTimer = null;
function showSkeletons() {
  clearTimeout(skeletonTimer);
  skeletonTimer = setTimeout(() => {
    loadingEl.innerHTML = Array.from({ length: 5 }, () => `
      <div class="skeleton-card">
        <div class="skeleton-tile"></div>
        <div class="skeleton-lines">
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
        </div>
      </div>`).join("");
    loadingEl.classList.remove("hidden");
  }, 150);
}

function hideSkeletons() {
  clearTimeout(skeletonTimer);
  loadingEl.classList.add("hidden");
  loadingEl.innerHTML = "";
}

function renderCard(item) {
  const card = document.createElement("div");
  const compact = state.listDensity === "compact";
  card.className = `item-card${compact ? " compact" : ""}`;
  card.dataset.id = item.id;

  // Link items get a colored monogram tile (first letter of the domain,
  // color deterministically derived from the domain) instead of the
  // generic link glyph — more scannable, and offline-safe (no favicons).
  const domain = item.type === "link" ? domainFromUrl(item.url) : "";
  const iconBox = document.createElement("div");
  iconBox.className = "item-card-icon";
  if (domain) {
    iconBox.classList.add("item-card-monogram");
    iconBox.style.background = monogramColor(domain);
    iconBox.textContent = domain[0].toUpperCase();
  } else {
    iconBox.innerHTML = `<svg viewBox="0 0 24 24" class="icon">${typeIconSvg(item.type)}</svg>`;
  }
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
    if (domain) {
      const dom = document.createElement("p");
      dom.className = "item-card-domain";
      dom.textContent = domain;
      body.appendChild(dom);
    }

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
    linkBadge.innerHTML = icons.linkBadge;
    actions.appendChild(linkBadge);
  }

  const pinBtn = document.createElement("button");
  pinBtn.type = "button";
  pinBtn.className = `item-card-pin${item.pinned ? " active" : ""}`;
  pinBtn.innerHTML = icons.pin;
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
 *
 * Long-press (holding still for 500ms) opens the context menu instead.
 * It lives here rather than in its own handler so it can share this
 * gesture's state: any drag cancels the press, and a fired press
 * suppresses the tap-to-open click that would otherwise follow.
 */
function attachSwipe(card, item) {
  const THRESHOLD = 72;
  const LONG_PRESS_MS = 500;
  let startX = null;
  let startY = null;
  let dx = 0;
  let active = false;
  let dragged = false;
  let longPressTimer = null;
  let longPressed = false;

  card.style.touchAction = "pan-y";

  const startLongPress = () => {
    clearTimeout(longPressTimer);
    longPressed = false;
    longPressTimer = setTimeout(() => {
      if (dragged) return;
      longPressed = true;
      if (navigator.vibrate) navigator.vibrate(8); // subtle "it triggered" cue
      onLongPress(item);
    }, LONG_PRESS_MS);
  };
  const cancelLongPress = () => clearTimeout(longPressTimer);

  card.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    active = true;
    dragged = false;
    card.style.transition = "none";
    startLongPress();
  }, { passive: true });

  // Desktop equivalent — press and hold with the mouse.
  card.addEventListener("mousedown", startLongPress);
  card.addEventListener("mousemove", cancelLongPress);
  card.addEventListener("mouseup", cancelLongPress);
  card.addEventListener("mouseleave", cancelLongPress);

  card.addEventListener("touchmove", (e) => {
    if (!active || startX === null) return;
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    const deltaX = x - startX;
    const deltaY = y - startY;
    // Any real movement means this is a scroll or a swipe, not a press.
    if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) cancelLongPress();
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
    cancelLongPress();
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
    // A long-press already acted (menu is open) — don't also open the item.
    if (longPressed) {
      e.preventDefault();
      e.stopPropagation();
      longPressed = false;
      return;
    }
    if (dragged) {
      e.preventDefault();
      e.stopPropagation();
      dragged = false;
      return;
    }
    onOpenItem(item.id);
  });
}

/** Bare registrable-ish host for display: strips protocol and a leading www. */
function domainFromUrl(url) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (_) {
    // Not a parseable absolute URL — best-effort strip.
    return String(url).replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}

/** Deterministic, evenly-distributed tile color from a domain (stable per site). */
function monogramColor(domain) {
  let hash = 0;
  for (let i = 0; i < domain.length; i++) hash = (hash * 31 + domain.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 48%, 46%)`;
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
