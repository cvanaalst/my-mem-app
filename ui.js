/*
 * Second Memory — shared UI helpers: toasts, confirm dialog, tag chip
 * widgets, date formatting. Used by every view module.
 */
import { i18n } from "./i18n.js";

const { t } = i18n;

/* ------------------------------------------------------------------ toast */

/**
 * Shows a toast. Plain call signature unchanged: toast(message, kind).
 * Pass options.actionLabel + options.onAction for an inline action
 * button (e.g. "Undo") — the toast then stays up longer (5s by default)
 * to give time to tap it. options.onExpire fires if the toast times out
 * WITHOUT the action being taken (not at all if it was), letting a
 * caller finalize something irreversible only once undo is off the table.
 */
export function toast(message, kind = "default", options = {}) {
  const { actionLabel, onAction, onExpire, duration } = options;
  const container = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = `toast${kind !== "default" ? ` ${kind}` : ""}`;

  const msgSpan = document.createElement("span");
  msgSpan.textContent = message;
  el.appendChild(msgSpan);

  let timer = null;
  const dismiss = (expired) => {
    clearTimeout(timer);
    el.remove();
    if (expired && onExpire) onExpire();
  };

  if (actionLabel && onAction) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "toast-action";
    btn.textContent = actionLabel;
    btn.addEventListener("click", () => {
      dismiss(false);
      onAction();
    });
    el.appendChild(btn);
  }

  container.appendChild(el);
  timer = setTimeout(() => dismiss(true), duration || (actionLabel ? 5000 : 2600));
}

/* ------------------------------------------------------------------- open */

/** Opens a plain URL (link items) in a new tab/window. */
export function openInNewTab(url) {
  window.open(url, "_blank", "noopener");
}

/**
 * Opens a Blob in a new tab via a temporary object URL, letting the
 * browser/OS decide how to handle it based on the blob's own MIME type —
 * e.g. iOS Safari's Quick Look offers "Open in…" with any installed app
 * that handles that type (Excel, Word, a Markdown editor, etc.). This is
 * the closest a static client-only web app can get to "open in the
 * correct native app": there's no way to name a specific target app or
 * attach a real filename/extension to a blob: URL, only the MIME type.
 */
export function openBlobInNewTab(blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/**
 * For blobs that aren't available synchronously (e.g. read from
 * IndexedDB) — Safari only allows window.open() to succeed when it runs
 * synchronously inside the click handler; once you `await` anything
 * first, the "user activation" is gone and the popup is silently
 * blocked, with no error to catch. Call this immediately in the click
 * handler to open a blank tab while activation is still live, then call
 * the returned function once the blob is ready to navigate that tab to
 * it. (No "noopener" here — that makes window.open() return null, which
 * would defeat the whole point of keeping a handle to navigate later.)
 */
export function openTabForAsyncBlob() {
  const pending = window.open("", "_blank");
  return (blob) => {
    if (!blob) { if (pending) pending.close(); return; }
    const url = URL.createObjectURL(blob);
    if (pending && !pending.closed) {
      pending.location.href = url;
    } else {
      // The blank open was blocked too (e.g. popups fully disabled) —
      // this will likely also be blocked, but it's the best fallback.
      window.open(url, "_blank", "noopener");
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
}

/* ----------------------------------------------------------- modal focus */

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Makes an overlay behave like a real modal for keyboard users: Tab cycles
 * within it instead of escaping to the page behind, Escape closes it, and
 * focus returns to whatever opened it. Call the returned release() when the
 * overlay closes. Visibility is tested via getClientRects() so hidden
 * controls (e.g. the Cancel button in alertDialog) are skipped.
 */
export function trapFocus(overlay, onEscape) {
  const previouslyFocused = document.activeElement;
  const focusable = () =>
    [...overlay.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);

  function onKeydown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      if (onEscape) onEscape();
      return;
    }
    if (e.key !== "Tab") return;
    const items = focusable();
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  document.addEventListener("keydown", onKeydown, true);
  const first = focusable()[0];
  if (first) first.focus();

  return function release() {
    document.removeEventListener("keydown", onKeydown, true);
    if (previouslyFocused && typeof previouslyFocused.focus === "function") previouslyFocused.focus();
  };
}

/* --------------------------------------------------------------- confirm */

export function confirmDialog(message, okLabel) {
  const overlay = document.getElementById("confirm-dialog");
  const msgEl = document.getElementById("confirm-message");
  const okBtn = document.getElementById("confirm-ok");
  const cancelBtn = document.getElementById("confirm-cancel");

  msgEl.textContent = message;
  okBtn.textContent = okLabel || t("confirmOk");
  okBtn.classList.add("danger");
  cancelBtn.classList.remove("hidden");
  overlay.classList.remove("hidden");

  return new Promise((resolve) => {
    // Escape means "don't do the risky thing", i.e. same as Cancel.
    const release = trapFocus(overlay, () => onCancel());
    function cleanup(result) {
      release();
      overlay.classList.add("hidden");
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }
    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
  });
}

/** Same dialog, OK-only — for confirmations the user must actually notice (e.g. backup/restore completion), unlike an auto-dismissing toast. */
export function alertDialog(message, okLabel) {
  const overlay = document.getElementById("confirm-dialog");
  const msgEl = document.getElementById("confirm-message");
  const okBtn = document.getElementById("confirm-ok");
  const cancelBtn = document.getElementById("confirm-cancel");

  msgEl.textContent = message;
  okBtn.textContent = okLabel || t("confirmOk");
  okBtn.classList.remove("danger");
  cancelBtn.classList.add("hidden");
  overlay.classList.remove("hidden");

  return new Promise((resolve) => {
    const release = trapFocus(overlay, () => onOk()); // OK is the only action
    function onOk() {
      release();
      overlay.classList.add("hidden");
      cancelBtn.classList.remove("hidden");
      okBtn.removeEventListener("click", onOk);
      resolve();
    }
    okBtn.addEventListener("click", onOk);
  });
}

/* ------------------------------------------------------------- tag input */

/**
 * Wires a text input + chip row into an editable tag list.
 * Tags are lowercased and trimmed. Enter or comma commits the current
 * text as a tag; clicking a chip's remove control deletes it.
 * Returns { getTags(), setTags(tags), renderSuggestions(allTags) }.
 */
export function setupTagInput(inputEl, chipRowEl, suggestionRowEl, initialTags = []) {
  let tags = [...initialTags];

  function render() {
    chipRowEl.innerHTML = "";
    for (const tag of tags) {
      const chip = document.createElement("span");
      chip.className = "chip removable";
      chip.innerHTML = `<span>${escapeHtml(tag)}</span><span class="chip-remove">&times;</span>`;
      chip.querySelector(".chip-remove").addEventListener("click", () => {
        tags = tags.filter((x) => x !== tag);
        render();
      });
      chipRowEl.appendChild(chip);
    }
  }

  // Splits on commas so pasted/autofilled/programmatically-set text
  // ("ai,work,foo") becomes separate tags too, not just interactive
  // comma keypresses.
  function commit(raw) {
    const parts = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    let changed = false;
    for (const tag of parts) {
      if (!tags.includes(tag)) { tags.push(tag); changed = true; }
    }
    if (changed) render();
  }

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(inputEl.value);
      inputEl.value = "";
    } else if (e.key === "Backspace" && inputEl.value === "" && tags.length > 0) {
      tags.pop();
      render();
    }
  });
  inputEl.addEventListener("blur", () => {
    if (inputEl.value.trim()) {
      commit(inputEl.value);
      inputEl.value = "";
    }
  });

  render();

  return {
    getTags: () => [...tags],
    // Full reset for reusing this widget on a new item/session: also
    // clears any uncommitted text left in the input (see initAddView /
    // initDetailView — the widget itself is created once and reused).
    setTags: (newTags) => { tags = [...newTags]; inputEl.value = ""; render(); },
    renderSuggestions(allTags) {
      if (!suggestionRowEl) return;
      const suggestions = allTags.filter((tg) => !tags.includes(tg)).slice(0, 12);
      suggestionRowEl.innerHTML = "";
      suggestionRowEl.classList.toggle("hidden", suggestions.length === 0);
      for (const tg of suggestions) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip";
        chip.textContent = tg;
        chip.addEventListener("click", () => commit(tg));
        suggestionRowEl.appendChild(chip);
      }
    },
  };
}

/* -------------------------------------------------------------- utility */

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

export function formatDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString(i18n.getLang() === "nl" ? "nl-NL" : "en-GB", {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch (_) {
    return iso;
  }
}

export function formatBytes(bytes) {
  if (bytes == null) return "?";
  const units = ["B", "KB", "MB", "GB"];
  let val = bytes, i = 0;
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
  return `${val.toFixed(val < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * True when the app is running as an installed/standalone PWA (iOS
 * home-screen or any display-mode: standalone). Shared by the install
 * hint (app.js) and the OAuth flow (sync.js), which behave differently
 * standalone.
 */
export function isStandalone() {
  return window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
}

/**
 * Grows a textarea's height to fit its content instead of scrolling —
 * used for the comment field, which can now hold more than one line.
 * Call once per element (at view-init time, NOT on every open — same
 * listener-accumulation trap as the tag input, see setupTagInput).
 * Returns { resize() } so callers can re-fit it after setting .value
 * programmatically, which doesn't fire an input event on its own.
 */
export function autoGrowTextarea(el) {
  const resize = () => {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  el.addEventListener("input", resize);
  resize();
  return { resize };
}
