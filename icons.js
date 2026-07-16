/*
 * Second Memory — single source for the SVG icons injected from JS (as
 * innerHTML). Static icons that live directly in index.html markup aren't
 * here; these are the ones a view builds at runtime, previously duplicated
 * or scattered as inline strings across app.js / view-list.js /
 * view-detail.js. Each value is complete <svg> markup so callers just
 * assign it to innerHTML.
 */

export const icons = {
  // List-density toggle — the icon shows the CURRENT density (outline style
  // to match the nav chrome; comfortable = fewer taller rows).
  densityComfortable: '<svg viewBox="0 0 24 24" class="icon icon-line"><rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/></svg>',
  densityCompact: '<svg viewBox="0 0 24 24" class="icon icon-line"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="3" y1="14" x2="21" y2="14"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',

  // Favorite/pin star on list cards.
  pin: '<svg viewBox="0 0 24 24" class="icon"><path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01z"/></svg>',

  // "This item participates in a link" badge on list cards.
  linkBadge: '<svg viewBox="0 0 24 24" class="icon"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>',

  // Detail text field: edit (pencil) / preview (eye) toggle.
  pencil: '<svg viewBox="0 0 24 24" class="icon"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>',
  eye: '<svg viewBox="0 0 24 24" class="icon"><path d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 12a5 5 0 110-10 5 5 0 010 10zm0-8a3 3 0 100 6 3 3 0 000-6z"/></svg>',
};

/**
 * Inner path markup for an item type's icon (caller wraps it in its own
 * <svg> so it can size/style the wrapper) — used for list-card type tiles
 * and the link-picker result rows.
 */
export function typeIconSvg(type) {
  const paths = {
    link: '<path d="M3.9 12a4.1 4.1 0 014.1-4.1h4V6H8a6 6 0 000 12h4v-1.9H8A4.1 4.1 0 013.9 12zM9 13h6v-2H9v2zm7-7h-4v1.9h4A4.1 4.1 0 0120.1 12 4.1 4.1 0 0116 16.1h-4V18h4a6 6 0 000-12z"/>',
    text: '<path d="M4 4h16v2H4zm0 5h16v2H4zm0 5h10v2H4z"/>',
    image: '<path d="M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1zm1 2v9.59l3.3-3.3a1 1 0 011.4 0L14 15.6l1.3-1.3a1 1 0 011.4 0L19 16.6V6H6zm3 4a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>',
    file: '<path d="M6 2h9l5 5v15a1 1 0 01-1 1H6a1 1 0 01-1-1V3a1 1 0 011-1zm8 1.5V8h4.5L14 3.5z"/>',
  };
  return paths[type] || paths.file;
}
