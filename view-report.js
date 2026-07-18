/*
 * Second Memory — simple reporting view: item counts, a tag cloud, and
 * a small inline-SVG bar chart of items captured per week. No charting
 * library — just enough SVG to draw bars, consistent with the app's
 * "no dependencies" constraint.
 */
import { db } from "./db.js";
import { i18n } from "./i18n.js";
import { escapeHtml } from "./ui.js";

const { t } = i18n;

const tilesEl = document.getElementById("report-tiles");
const typeBarsEl = document.getElementById("report-type-bars");
const weekChartEl = document.getElementById("report-week-chart");
const tagCloudEl = document.getElementById("report-tag-cloud");

const TYPE_LABEL_KEYS = { link: "typeLink", text: "typeText", image: "typeImage", list: "typeList", file: "typeFile" };

export async function refreshReportView() {
  const stats = await db.getStats();
  renderTiles(stats);
  renderTypeBars(stats);
  renderWeekChart(stats.byWeek);
  await renderTagCloud();
}

function renderTiles(stats) {
  const tiles = [
    { label: t("reportTotal"), value: stats.total },
    { label: t("reportPinned"), value: stats.pinnedCount },
    { label: t("reportRemindersDue"), value: stats.remindersDueCount },
  ];
  // Only surface the open-tasks tile when there is at least one checklist,
  // so users who never make lists don't see a permanent "0".
  if (stats.totalTasks > 0) {
    tiles.push({ label: t("reportOpenTasks"), value: stats.openTasks });
  }
  tilesEl.innerHTML = tiles
    .map((tile) => `<div class="report-tile"><span class="report-tile-value">${tile.value}</span><span class="report-tile-label">${tile.label}</span></div>`)
    .join("");
}

function renderTypeBars(stats) {
  const max = Math.max(1, ...Object.values(stats.byType));
  typeBarsEl.innerHTML = Object.entries(stats.byType)
    .map(([type, count]) => {
      const pct = Math.round((count / max) * 100);
      return `<div class="report-bar-row">
        <span class="report-bar-label">${t(TYPE_LABEL_KEYS[type])}</span>
        <div class="report-bar-track"><div class="report-bar-fill" style="width:${pct}%"></div></div>
        <span class="report-bar-count">${count}</span>
      </div>`;
    })
    .join("");
}

function renderWeekChart(byWeek) {
  const width = 320;
  const height = 90;
  const gap = 4;
  const barWidth = width / byWeek.length - gap;
  const max = Math.max(1, ...byWeek.map((w) => w.count));
  const bars = byWeek
    .map((w, i) => {
      const barHeight = Math.max(2, Math.round((w.count / max) * (height - 8)));
      const x = i * (barWidth + gap);
      const y = height - barHeight;
      return `<rect class="report-bar" x="${x.toFixed(1)}" y="${y}" width="${barWidth.toFixed(1)}" height="${barHeight}" rx="2"></rect>`;
    })
    .join("");
  weekChartEl.innerHTML = `<svg viewBox="0 0 ${width} ${height}" class="report-week-svg" preserveAspectRatio="none">${bars}</svg>`;
}

async function renderTagCloud() {
  const tags = await db.getAllTags();
  if (tags.length === 0) {
    tagCloudEl.innerHTML = `<p class="report-empty">${t("reportNoTags")}</p>`;
    return;
  }
  const maxCount = Math.max(...tags.map((tg) => tg.count));
  tagCloudEl.innerHTML = tags
    .map(({ tag, count }) => {
      const scale = 0.85 + (count / maxCount) * 0.5;
      return `<span class="chip" style="font-size:${(13 * scale).toFixed(1)}px">${escapeHtml(tag)} (${count})</span>`;
    })
    .join("");
}
