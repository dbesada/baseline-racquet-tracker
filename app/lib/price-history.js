// Daily lowest prices per racquet (recorded by the price check in D1) and the
// small summaries the site shows: the 30-day low, whether today's price is
// the lowest in 30 days or higher than usual, and a chart line.

const dayMs = 24 * 60 * 60 * 1000;

// The calendar day in Toronto (YYYY-MM-DD), so a day matches what visitors see.
export function torontoDay(time = Date.now()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date(time)).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

const dayNumber = (day) => Date.parse(`${day}T12:00:00Z`) / dayMs;

// points: [{ day: "YYYY-MM-DD", low: number }] in any order.
// Returns null until there are at least 3 days of history.
export function historySummary(points, currentPrice, today = torontoDay()) {
  const sorted = [...(points ?? [])].filter((point) => Number.isFinite(point?.low) && /^\d{4}-\d{2}-\d{2}$/.test(point?.day ?? "")).sort((a, b) => a.day.localeCompare(b.day));
  if (sorted.length < 3) return null;
  const recent = sorted.filter((point) => dayNumber(today) - dayNumber(point.day) <= 30);
  if (!recent.length) return null;
  const lowest = recent.reduce((best, point) => (point.low < best.low ? point : best));
  const highest = recent.reduce((best, point) => (point.low > best.low ? point : best));
  const ordered = recent.map((point) => point.low).sort((a, b) => a - b);
  const median = ordered[Math.floor(ordered.length / 2)];
  const price = Number.isFinite(currentPrice) ? currentPrice : null;
  // "Lowest in 30 days" needs 30 days of history; until then the honest claim
  // is "lowest since tracking began", and only after a week of history.
  const coveredDays = dayNumber(today) - dayNumber(sorted[0].day);
  const coversMonth = coveredDays >= 30;
  const atLow = price !== null && price <= lowest.low * 1.005;
  return {
    since: sorted[0].day,
    days: sorted.length,
    low30: lowest.low,
    low30Day: lowest.day,
    high30: highest.low,
    median30: median,
    coversMonth,
    // Within half a percent of the low counts as the low.
    isLowest30: coversMonth && atLow,
    isLowestSinceStart: !coversMonth && coveredDays >= 7 && atLow,
    aboveUsual: coveredDays >= 14 && price !== null && price > median * 1.08,
  };
}

// SVG path ("M x y L x y …") for a price line inside width × height, oldest
// to newest left to right. Days without a price are skipped.
export function historyPath(points, width, height, padding = 4) {
  const sorted = [...(points ?? [])].filter((point) => Number.isFinite(point?.low)).sort((a, b) => a.day.localeCompare(b.day));
  if (sorted.length < 2) return "";
  const first = dayNumber(sorted[0].day);
  const span = Math.max(dayNumber(sorted.at(-1).day) - first, 1);
  const lows = sorted.map((point) => point.low);
  const min = Math.min(...lows);
  const range = Math.max(Math.max(...lows) - min, 1);
  return sorted.map((point, index) => {
    const x = padding + ((dayNumber(point.day) - first) / span) * (width - 2 * padding);
    const y = padding + (1 - (point.low - min) / range) * (height - 2 * padding);
    return `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}
