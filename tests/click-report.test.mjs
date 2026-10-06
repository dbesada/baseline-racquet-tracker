import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readClickRows, weekStart, weeklyRetailerClicks } from "../scripts/click-report.mjs";

// Wednesday, October 7, 2026, noon in Toronto (EDT, UTC-4).
const now = Date.parse("2026-10-07T16:00:00Z");
const click = (ts, retailer, network = null) => ({ ts, offerId: `${retailer}:1`, retailer, market: "CA", network });

test("weeks start on Monday in Toronto time", () => {
  assert.equal(weekStart(Date.parse("2026-10-05T04:00:00Z")), "2026-10-05", "Monday 00:00 in Toronto");
  assert.equal(weekStart(Date.parse("2026-10-05T03:59:00Z")), "2026-09-28", "still Sunday night in Toronto");
  assert.equal(weekStart(Date.parse("2026-10-11T23:00:00Z")), "2026-10-05", "Sunday evening");
  assert.equal(weekStart(Date.parse("2026-11-02T05:30:00Z")), "2026-11-02", "after the switch to EST");
});

test("clicks are counted per retailer per week, newest week first", () => {
  const report = weeklyRetailerClicks([
    click("2026-10-06T15:00:00Z", "ATR Sports", "store-referral"),
    click("2026-10-05T15:00:00Z", "ATR Sports"),
    click("2026-09-30T15:00:00Z", "ATR Sports"),
    click("2026-10-06T15:00:00Z", "Just Tennis"),
    click("2026-08-01T15:00:00Z", "Just Tennis"), // older than eight weeks
    click("2026-10-20T15:00:00Z", "Just Tennis"), // in the future
  ], { now });
  assert.equal(report.weeks.length, 8);
  assert.deepEqual(report.weeks.slice(0, 3), ["2026-10-05", "2026-09-28", "2026-09-21"]);
  assert.equal(report.weeks.at(-1), "2026-08-17");
  assert.deepEqual(report.retailers.map((row) => [row.retailer, row.weeks.slice(0, 2), row.total, row.affiliate]), [
    ["ATR Sports", [2, 1], 3, 1],
    ["Just Tennis", [1, 0], 1, 0],
  ]);
  assert.equal(report.other, null);
  assert.equal(report.totalClicks, 4);
});

test("retailers beyond the top 15 are grouped as Other", () => {
  const rows = Array.from({ length: 18 }, (_, index) => Array.from({ length: 20 - index }, () => click("2026-10-06T15:00:00Z", `Store ${String(index).padStart(2, "0")}`, index === 17 ? "n" : null))).flat();
  const report = weeklyRetailerClicks(rows, { now });
  assert.equal(report.retailers.length, 15);
  assert.equal(report.retailers[0].retailer, "Store 00");
  assert.deepEqual(report.other, { retailer: "Other (3)", weeks: [5 + 4 + 3, 0, 0, 0, 0, 0, 0, 0], total: 12, affiliate: 3 });
  assert.equal(report.totalClicks, rows.length);
});

test("bad rows are skipped and an empty or missing log gives an empty report", async () => {
  const report = weeklyRetailerClicks([null, {}, { ts: "nope", retailer: "X" }, { ts: "2026-10-06T15:00:00Z" }, click("2026-10-06T15:00:00Z", "ATR Sports")], { now });
  assert.deepEqual(report.retailers.map((row) => row.retailer), ["ATR Sports"]);
  const folder = await mkdtemp(join(tmpdir(), "baseline-report-"));
  assert.deepEqual(await readClickRows(join(folder, "missing.jsonl")), []);
  const file = join(folder, "clicks.jsonl");
  await writeFile(file, `${JSON.stringify(click("2026-10-06T15:00:00Z", "ATR Sports"))}\n{broken\n\n`);
  assert.deepEqual((await readClickRows(file)).map((row) => row.retailer), ["ATR Sports"]);
  assert.equal(weeklyRetailerClicks([], { now }).totalClicks, 0);
});

test("only admins get the report, through the existing Analytics panel", async () => {
  const relay = await readFile(new URL("../scripts/baseline-relay.mjs", import.meta.url), "utf8");
  const handler = relay.slice(relay.indexOf("async function handleAnalytics"), relay.indexOf("async function handleEbayAccountDeletion"));
  assert.ok(handler.indexOf("if (publicPreview) {") < handler.indexOf("weeklyRetailerClicks"), "public preview requests must return before the report is built");
  assert.match(handler, /retailerWeeks: weeklyRetailerClicks\(clicks\)/);
  assert.match(handler, /readClickRows\(clickLogFile\)/);
  const panel = await readFile(new URL("../app/ui/AnalyticsPanel.tsx", import.meta.url), "utf8");
  assert.match(panel, /RETAILER CLICKS BY WEEK/);
  assert.match(panel, /analytics\.retailerWeeks && <RetailerWeeksTable/);
  const app = await readFile(new URL("../app/ui/BaselineApp.tsx", import.meta.url), "utf8");
  assert.match(app, /analyticsOpen && !data\?\.publicPreview && <AnalyticsPanel/);
});
