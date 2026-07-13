import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("ships the finished Baseline tracker and its price API", async () => {
  const [page, ui, route, layout, hosting] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/BaselineApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/tracker/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /BaselineApp/);
  assert.match(ui, /Wait for the/);
  assert.match(route, /Wilson Blade 98/);
  assert.match(route, /Wilson Blade 98 v8/);
  assert.match(route, /shortlist_slots/);
  assert.match(route, /shortlistSlotCount = 6/);
  assert.match(route, /Head Speed Pro 2026/);
  assert.match(ui, /YOUR TOP FRAMES/);
  assert.match(ui, /Top-rated & available/);
  assert.match(ui, /Six frames/);
  assert.match(ui, /modelImages/);
  assert.match(ui, /racquets\/blade-v8\.png/);
  assert.match(ui, /model-thumbnail/);
  const racquetImages = [...ui.matchAll(/"\/racquets\/([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(racquetImages).size, 20);
  await Promise.all(racquetImages.map((filename) => access(new URL(`../public/racquets/${filename}`, import.meta.url))));
  assert.match(route, /collections\/tennis-racquets/);
  assert.match(route, /price_history/);
  assert.match(route, /isGripThree/);
  assert.match(route, /saleOffers/);
  assert.match(route, /retailer_settings/);
  assert.match(ui, /Open tracker settings/);
  assert.match(layout, /og\.png/);
  assert.match(hosting, /"d1": "DB"/);
  assert.doesNotMatch(`${page}${ui}${layout}`, /codex-preview|SkeletonPreview/);
  await access(new URL("../dist/server/index.js", import.meta.url));
  await access(new URL("../public/og.png", import.meta.url));
});
