// Aggregate, privacy-light analytics for the public beta. Visitors' browsers
// send named events; the relay adds them to daily counts in one JSON file.
// No IP address, user agent, cookie or per-visitor record is kept: only
// "event X happened N times on day D", plus a short, fixed-format detail for
// a few events (which section, which term, which referring site).

export const retentionDays = 90;
const dayMs = 24 * 60 * 60 * 1000;
const maxDetailsPerDay = 40;

// Accepted events and the detail each may carry.
const detailRules = {
  page_view: null,
  visit: (detail) => normalizeSource(detail),
  browse_section: (detail) => (/^[a-z-]{2,24}$/.test(detail) ? detail : null),
  used_market: null,
  retailer_open: null,
  comparison_open: null,
  deal_open: null,
  coach_open: null,
  coach_complete: (detail) => (["racquets", "strings", "complete"].includes(detail) ? detail : null),
  start_here: (detail) => (["coach", "browse", "hide"].includes(detail) ? detail : null),
  term_tip: (detail) => (/^[a-z-]{2,24}$/.test(detail) ? detail : null),
  sale_filter: (detail) => (["all", "unstrung", "prestrung"].includes(detail) ? detail : null),
};

// A referring site's name ("google.com"), or "direct". Never a full address.
export function normalizeSource(value) {
  const host = String(value ?? "").trim().toLowerCase().replace(/^www\./, "");
  if (!host || host === "direct") return "direct";
  return /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(host) && host.length <= 60 ? host : null;
}

export function emptyAnalytics(now = Date.now()) {
  return { version: 2, startedAt: new Date(now).toISOString(), days: {} };
}

// Adds one event to `analytics` (mutated) and returns whether it was accepted.
export function recordEvent(analytics, event, detail, now = Date.now()) {
  if (!Object.hasOwn(detailRules, event)) return false;
  const day = new Date(now).toISOString().slice(0, 10);
  const bucket = analytics.days[day] ?? { events: {}, details: {} };
  bucket.events[event] = (bucket.events[event] ?? 0) + 1;
  const rule = detailRules[event];
  const value = rule && detail ? rule(String(detail)) : null;
  if (value && event === "browse_section") {
    // Kept in the original place so earlier days still read the same way.
    bucket.details[value] = (bucket.details[value] ?? 0) + 1;
  } else if (value) {
    bucket.breakdown ??= {};
    const counts = bucket.breakdown[event] ??= {};
    const key = Object.hasOwn(counts, value) || Object.keys(counts).length < maxDetailsPerDay ? value : "other";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  analytics.days[day] = bucket;
  const cutoff = new Date(now - retentionDays * dayMs).toISOString().slice(0, 10);
  for (const key of Object.keys(analytics.days)) if (key < cutoff) delete analytics.days[key];
  return true;
}

function dayKeys(days, now) {
  return Array.from({ length: days }, (_, index) => new Date(now - (days - 1 - index) * dayMs).toISOString().slice(0, 10));
}

const ranked = (counts, top = 10) => Object.entries(counts)
  .map(([key, count]) => ({ key, count }))
  .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
  .slice(0, top);

function add(target, key, count = 1) {
  target[key] = (target[key] ?? 0) + count;
}

// Totals for the days in `keys`, from events and from the /go/ click log.
function periodTotals(analytics, clicksByDay, keys) {
  const totals = { visits: 0, pageViews: 0, buyClicks: 0, retailerOpens: 0, comparisons: 0, coachOpens: 0, coachCompletes: 0, usedMarket: 0 };
  for (const key of keys) {
    const events = analytics.days?.[key]?.events ?? {};
    totals.visits += events.visit ?? 0;
    totals.pageViews += events.page_view ?? 0;
    totals.retailerOpens += events.retailer_open ?? 0;
    totals.comparisons += events.comparison_open ?? 0;
    totals.coachOpens += events.coach_open ?? 0;
    totals.coachCompletes += events.coach_complete ?? 0;
    totals.usedMarket += events.used_market ?? 0;
    totals.buyClicks += clicksByDay.get(key)?.length ?? 0;
  }
  return totals;
}

// The admin report for the last `days` days (and the same span before it).
export function summarizeAnalytics(analytics, { clicks = [], dashboard = {}, days = 30, now = Date.now() } = {}) {
  const keys = dayKeys(days, now);
  const previousKeys = dayKeys(days, now - days * dayMs);
  const clicksByDay = new Map();
  for (const row of clicks) {
    const time = Date.parse(row?.ts);
    if (!Number.isFinite(time)) continue;
    const key = new Date(time).toISOString().slice(0, 10);
    if (!clicksByDay.has(key)) clicksByDay.set(key, []);
    clicksByDay.get(key).push(row);
  }

  const sections = {};
  const breakdown = {};
  for (const key of keys) {
    const bucket = analytics.days?.[key];
    for (const [section, count] of Object.entries(bucket?.details ?? {})) add(sections, section, count);
    for (const [event, counts] of Object.entries(bucket?.breakdown ?? {})) {
      breakdown[event] ??= {};
      for (const [detail, count] of Object.entries(counts)) add(breakdown[event], detail, count);
    }
  }

  const byKind = {};
  const byModel = {};
  for (const key of keys) {
    for (const row of clicksByDay.get(key) ?? []) {
      add(byKind, typeof row.kind === "string" ? row.kind : "unknown");
      if (typeof row.model === "string") add(byModel, row.model);
    }
  }
  const modelNames = dashboard.modelNames ?? {};

  return {
    startedAt: analytics.startedAt,
    windowDays: days,
    totals: periodTotals(analytics, clicksByDay, keys),
    previous: periodTotals(analytics, clicksByDay, previousKeys),
    daily: keys.map((key) => {
      const events = analytics.days?.[key]?.events ?? {};
      return { date: key, visits: events.visit ?? 0, pageViews: events.page_view ?? 0, buyClicks: clicksByDay.get(key)?.length ?? 0 };
    }),
    sections: ranked(sections, 12).map(({ key, count }) => ({ section: key, count })),
    clicksByKind: ranked(byKind, 10).map(({ key, count }) => ({ kind: key, count })),
    topRacquets: ranked(byModel, 10).map(({ key, count }) => ({ modelKey: key, name: modelNames[key] ?? key, count })),
    referrers: ranked(breakdown.visit ?? {}, 10).map(({ key, count }) => ({ source: key, count })),
    beginner: {
      startHere: { coach: breakdown.start_here?.coach ?? 0, browse: breakdown.start_here?.browse ?? 0, hide: breakdown.start_here?.hide ?? 0 },
      coachCompletes: ranked(breakdown.coach_complete ?? {}, 3).map(({ key, count }) => ({ focus: key, count })),
      terms: ranked(breakdown.term_tip ?? {}, 10).map(({ key, count }) => ({ term: key, count })),
      saleFilters: ranked(breakdown.sale_filter ?? {}, 3).map(({ key, count }) => ({ filter: key, count })),
    },
    operations: {
      freshOffers: dashboard.sourceHealth?.freshOffers ?? 0,
      liveSources: dashboard.sourceHealth?.liveSources ?? 0,
      totalSources: dashboard.sourceHealth?.totalSources ?? 0,
      dropsLast24Hours: dashboard.dropsLast24Hours ?? 0,
      lastChecked: dashboard.lastCheck?.checkedAt ?? null,
    },
  };
}

// The report period an admin asked for: 7, 30 or 90 days (default 30).
export function reportDays(value) {
  const days = Number(value);
  return [7, 30, 90].includes(days) ? days : 30;
}
