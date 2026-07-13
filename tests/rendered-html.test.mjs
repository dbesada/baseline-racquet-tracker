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
