/*
 * Second Memory — minimal Markdown renderer for the "text" item type.
 * Deliberately small: headers, bold, italic, links, and lists — not a
 * full CommonMark implementation, just enough for saved notes. Pure and
 * dependency-free (unit-tested directly in tests.html, same pattern as
 * merge.js).
 *
 * Safety: all raw text is HTML-escaped before any markdown syntax is
 * applied, so nothing in the source can inject markup. Only http(s)/
 * mailto/relative URLs are rendered as real links — anything else (e.g.
 * a javascript: URL) falls back to plain text instead of a clickable link.
 */

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const SAFE_URL = /^(https?:\/\/|mailto:|\/|#)/i;

function renderInline(line) {
  let out = escapeHtml(line);
  // Links first: [label](url) — label/url here are already escaped, so
  // it's safe to splice them straight into the generated tag.
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
    if (!SAFE_URL.test(url)) return label;
    return `<a href="${url}" target="_blank" rel="noopener">${label}</a>`;
  });
  // Bold before italic so "**x**" isn't half-eaten by the italic regex.
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  out = out.replace(/\b_([^_]+)_\b/g, "<em>$1</em>");
  return out;
}

/** Renders a Markdown string to an HTML string. Returns "" for empty input. */
export function renderMarkdown(text) {
  if (!text) return "";
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let paragraph = [];
  let i = 0;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push(`<p>${paragraph.join("<br>")}</p>`);
      paragraph = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    const headerMatch = /^(#{1,3})\s+(.*)$/.exec(line);
    const ulMatch = /^[-*]\s+(.*)$/.exec(line);
    const olMatch = /^\d+\.\s+(.*)$/.exec(line);

    if (headerMatch) {
      flushParagraph();
      const level = headerMatch[1].length;
      blocks.push(`<h${level}>${renderInline(headerMatch[2])}</h${level}>`);
      i++;
    } else if (ulMatch) {
      flushParagraph();
      const items = [];
      while (i < lines.length) {
        const m = /^[-*]\s+(.*)$/.exec(lines[i]);
        if (!m) break;
        items.push(`<li>${renderInline(m[1])}</li>`);
        i++;
      }
      blocks.push(`<ul>${items.join("")}</ul>`);
    } else if (olMatch) {
      flushParagraph();
      const items = [];
      while (i < lines.length) {
        const m = /^\d+\.\s+(.*)$/.exec(lines[i]);
        if (!m) break;
        items.push(`<li>${renderInline(m[1])}</li>`);
        i++;
      }
      blocks.push(`<ol>${items.join("")}</ol>`);
    } else if (line.trim() === "") {
      flushParagraph();
      i++;
    } else {
      paragraph.push(renderInline(line));
      i++;
    }
  }
  flushParagraph();
  return blocks.join("");
}
