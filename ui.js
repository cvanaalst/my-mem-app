/*
 * Second Memory — shared UI helpers: toasts, confirm dialog, tag chip
 * widgets, date formatting. Used by every view module.
 */
import { i18n } from "./i18n.js";

const { t } = i18n;

/* ------------------------------------------------------------------ toast */

export function toast(message, kind = "default") {
  const container = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = `toast${kind !== "default" ? ` ${kind}` : ""}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

/* --------------------------------------------------------------- confirm */

export function confirmDialog(message, okLabel) {
  const overlay = document.getElementById("confirm-dialog");
  const msgEl = document.getElementById("confirm-message");
  const okBtn = document.getElementById("confirm-ok");
  const cancelBtn = document.getElementById("confirm-cancel");

  msgEl.textContent = message;
  okBtn.textContent = okLabel || t("confirmOk");
  overlay.classList.remove("hidden");

  return new Promise((resolve) => {
    function cleanup(result) {
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
    setTags: (newTags) => { tags = [...newTags]; render(); },
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

export function typeIconSvg(type) {
  const icons = {
    link: '<path d="M3.9 12a4.1 4.1 0 014.1-4.1h4V6H8a6 6 0 000 12h4v-1.9H8A4.1 4.1 0 013.9 12zM9 13h6v-2H9v2zm7-7h-4v1.9h4A4.1 4.1 0 0120.1 12 4.1 4.1 0 0116 16.1h-4V18h4a6 6 0 000-12z"/>',
    text: '<path d="M4 4h16v2H4zm0 5h16v2H4zm0 5h10v2H4z"/>',
    image: '<path d="M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1zm1 2v9.59l3.3-3.3a1 1 0 011.4 0L14 15.6l1.3-1.3a1 1 0 011.4 0L19 16.6V6H6zm3 4a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>',
    file: '<path d="M6 2h9l5 5v15a1 1 0 01-1 1H6a1 1 0 01-1-1V3a1 1 0 011-1zm8 1.5V8h4.5L14 3.5z"/>',
  };
  return icons[type] || icons.file;
}
