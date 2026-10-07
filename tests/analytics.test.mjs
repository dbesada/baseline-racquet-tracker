import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { emptyAnalytics, normalizeSource, recordEvent, reportDays, summarizeAnalytics } from "../scripts/analytics.mjs";
import { findListedOffer } from "../scripts/outbound-redirect.mjs";

const day = (date) => Date.parse(`${date}T15:00:00Z`);

test("only known events and well-formed details are stored", () => {
  const analytics = emptyAnalytics(day("2026-10-07"));
  const now = day("2026-10-07");
  assert.equal(recordEvent(analytics, "visit", "www.Google.com", now), true);
  assert.equal(recordEvent(analytics, "visit", "https://evil.example/path?x=1", now), true);
  assert.equal(recordEvent(analytics, "term_tip", "grip", now), true);
  assert.equal(recordEvent(analytics, "start_here", "coach", now), true);
  assert.equal(recordEvent(analytics, "start_here", "<script>", now), true);
  assert.equal(recordEvent(analytics, "made_up", "x", now), false);
  const bucket = analytics.days["2026-10-07"];
  assert.deepEqual(bucket.events, { visit: 2, term_tip: 1, start_here: 2 });
  assert.deepEqual(bucket.breakdown, { visit: { "google.com": 1 }, term_tip: { grip: 1 }, start_here: { coach: 1 } });
  assert.equal(normalizeSource(""), "direct");
  assert.equal(normalizeSource("reddit.com"), "reddit.com");
  assert.equal(normalizeSource("not a host"), null);
});

test("a day keeps at most 40 different details; the rest are counted as other", () => {
  const analytics = emptyAnalytics();
  const now = day("2026-10-07");
  for (let index = 0; index < 45; index += 1) recordEvent(analytics, "visit", `site${index}.com`, now);
  const counts = analytics.days["2026-10-07"].breakdown.visit;
  assert.equal(Object.keys(counts).length, 41);
  assert.equal(counts.other, 5);
});

test("days older than 90 are removed", () => {
  const analytics = emptyAnalytics();
  analytics.days["2026-06-01"] = { events: { page_view: 3 }, details: {} };
  recordEvent(analytics, "page_view", "", day("2026-10-07"));
  assert.deepEqual(Object.keys(analytics.days), ["2026-10-07"]);
});

test("the report adds up visits, buy clicks by section and top racquets, and compares periods", () => {
  const analytics = emptyAnalytics();
  const now = day("2026-10-07");
  recordEvent(analytics, "visit", "google.com", now);
  recordEvent(analytics, "visit", "direct", now);
  recordEvent(analytics, "page_view", "", now);
  recordEvent(analytics, "coach_open", "", now);
  recordEvent(analytics, "coach_complete", "racquets", now);
  recordEvent(analytics, "visit", "google.com", day("2026-10-02"));
  recordEvent(analytics, "visit", "google.com", day("2026-09-28"));
  // An older file: browse sections in "details", no breakdown.
  analytics.days["2026-10-06"] = { events: { page_view: 4, browse_section: 2 }, details: { strings: 2 } };
  const clicks = [
    { ts: "2026-10-07T12:00:00Z", retailer: "ATR", kind: "racquet", model: "blade-v9" },
    { ts: "2026-10-07T13:00:00Z", retailer: "ATR", kind: "racquet", model: "blade-v9" },
    { ts: "2026-10-06T13:00:00Z", retailer: "Tads", kind: "sale", model: null },
    { ts: "2026-10-05T13:00:00Z", retailer: "Tads" },
    { ts: "2026-09-29T13:00:00Z", retailer: "Tads", kind: "string" },
  ];
  const report = summarizeAnalytics(analytics, { clicks, dashboard: { modelNames: { "blade-v9": "Wilson Blade 98 v9" } }, days: 7, now });
  assert.equal(report.daily.length, 7);
  assert.equal(report.daily.at(-1).date, "2026-10-07");
  assert.deepEqual({ visits: report.totals.visits, pageViews: report.totals.pageViews, buyClicks: report.totals.buyClicks }, { visits: 3, pageViews: 5, buyClicks: 4 });
  assert.deepEqual({ visits: report.previous.visits, buyClicks: report.previous.buyClicks }, { visits: 1, buyClicks: 1 });
  assert.deepEqual(report.clicksByKind, [{ kind: "racquet", count: 2 }, { kind: "sale", count: 1 }, { kind: "unknown", count: 1 }]);
  assert.deepEqual(report.topRacquets, [{ modelKey: "blade-v9", name: "Wilson Blade 98 v9", count: 2 }]);
  assert.deepEqual(report.referrers, [{ source: "google.com", count: 2 }, { source: "direct", count: 1 }]);
  assert.deepEqual(report.sections, [{ section: "strings", count: 2 }]);
  assert.deepEqual(report.beginner.coachCompletes, [{ focus: "racquets", count: 1 }]);
  assert.equal(reportDays("90"), 90);
  assert.equal(reportDays("365"), 30);
});

test("clicks note the kind of listing and the racquet model", () => {
  const state = {
    offers: { a: { id: "a", modelKey: "blade-v9", store: "ATR" }, b: { id: "b", modelKey: "other-sale", store: "Tads" } },
    stringOffers: [{ id: "s", store: "Tennis Shop" }],
    specialOffers: [{ id: "x", modelKey: "pure-aero-98", store: "ATR" }],
  };
  assert.deepEqual([findListedOffer(state, "a").kind, findListedOffer(state, "a").model], ["racquet", "blade-v9"]);
  assert.deepEqual([findListedOffer(state, "b").kind, findListedOffer(state, "b").model], ["sale", null]);
  assert.deepEqual([findListedOffer(state, "s").kind, findListedOffer(state, "s").model], ["string", null]);
  assert.deepEqual([findListedOffer(state, "x").kind, findListedOffer(state, "x").model], ["special", "pure-aero-98"]);
  assert.equal(findListedOffer(state, "missing"), null);
});

test("the page counts visits once per tab session and marks tracked buttons", async () => {
  const app = await readFile(new URL("../app/ui/BaselineApp.tsx", import.meta.url), "utf8");
  assert.match(app, /sessionStorage\.getItem\(visitKey\)/);
  assert.match(app, /closest\?\.\("\[data-analytics\]"\)/);
  const tip = await readFile(new URL("../app/ui/TermTip.tsx", import.meta.url), "utf8");
  assert.match(tip, /data-analytics="term_tip" data-analytics-detail=\{term\}/);
  const relay = await readFile(new URL("../scripts/baseline-relay.mjs", import.meta.url), "utf8");
  assert.match(relay, /summarizeAnalytics\(analytics, \{ clicks, dashboard, days \}\)/);
});
