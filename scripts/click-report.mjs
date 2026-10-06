import { readFile } from "node:fs/promises";

// Clicks per retailer per week, from the /go/ click log, for the admin
// Analytics panel. Weeks run Monday to Sunday in Toronto time and are listed
// newest first. Nothing is stored: the log is read when the report is asked for.

const dayMs = 24 * 60 * 60 * 1000;

function localDate(time, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(time).map((part) => [part.type, part.value]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
}

// The Monday (YYYY-MM-DD) of the week that `time` falls in, in `timeZone`.
export function weekStart(time, timeZone = "America/Toronto") {
  const day = localDate(time, timeZone);
  const sinceMonday = (new Date(day).getUTCDay() + 6) % 7;
  return new Date(day - sinceMonday * dayMs).toISOString().slice(0, 10);
}

export function weeklyRetailerClicks(rows, { weeks = 8, top = 15, timeZone = "America/Toronto", now = Date.now() } = {}) {
  const latest = Date.parse(`${weekStart(now, timeZone)}T00:00:00Z`);
  const weekKeys = Array.from({ length: weeks }, (_, index) => new Date(latest - index * 7 * dayMs).toISOString().slice(0, 10));
  const column = new Map(weekKeys.map((key, index) => [key, index]));
  const byRetailer = new Map();
  for (const row of rows) {
    const time = Date.parse(row?.ts);
    if (!Number.isFinite(time) || typeof row.retailer !== "string") continue;
    const index = column.get(weekStart(time, timeZone));
    if (index === undefined) continue;
    const entry = byRetailer.get(row.retailer) ?? { retailer: row.retailer, weeks: Array(weeks).fill(0), total: 0, affiliate: 0 };
    entry.weeks[index] += 1;
    entry.total += 1;
    if (row.network) entry.affiliate += 1;
    byRetailer.set(row.retailer, entry);
  }
  const sorted = [...byRetailer.values()].sort((a, b) => b.total - a.total || a.retailer.localeCompare(b.retailer, "en-CA"));
  const rest = sorted.slice(top);
  const other = rest.length ? rest.reduce((sum, entry) => ({
    retailer: `Other (${rest.length})`,
    weeks: sum.weeks.map((count, index) => count + entry.weeks[index]),
    total: sum.total + entry.total,
    affiliate: sum.affiliate + entry.affiliate,
  }), { weeks: Array(weeks).fill(0), total: 0, affiliate: 0 }) : null;
  return {
    weeks: weekKeys,
    retailers: sorted.slice(0, top),
    other,
    totalClicks: sorted.reduce((sum, entry) => sum + entry.total, 0),
  };
}

// A missing log means no clicks yet; unreadable lines are skipped.
export async function readClickRows(path) {
  let text;
  try { text = await readFile(path, "utf8"); } catch { return []; }
  return text.split("\n").flatMap((line) => {
    try { return line ? [JSON.parse(line)] : []; } catch { return []; }
  });
}
