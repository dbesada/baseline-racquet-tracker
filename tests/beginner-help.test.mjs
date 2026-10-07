import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { glossary } from "../app/ui/glossary.js";
import { playerFit } from "../app/ui/player-fit.js";

test("player fit follows head size and weight, and guesses nothing when either is missing", () => {
  assert.equal(playerFit({ head: "105 in²", weight: "280 g" }).level, "beginner");
  assert.equal(playerFit({ head: "100", weight: "285" }).level, "beginner");
  assert.equal(playerFit({ head: "100", weight: "300" }).level, "intermediate");
  assert.equal(playerFit({ head: "98", weight: "285" }).level, "intermediate");
  assert.equal(playerFit({ head: "98", weight: "305" }).level, "advanced");
  assert.equal(playerFit({ head: "100", weight: "318" }).level, "advanced");
  assert.deepEqual(playerFit({ head: "105", weight: "280" }).reasons, ["big sweet spot", "light to swing"]);
  for (const spec of [undefined, {}, { head: "100" }, { weight: "300" }, { head: "n/a", weight: "300" }, { head: "100", weight: "11.2 oz" }]) {
    assert.equal(playerFit(spec), null, JSON.stringify(spec));
  }
});

test("every term the UI explains has a plain-English entry", async () => {
  const ui = new URL("../app/ui/", import.meta.url);
  const used = new Set();
  for (const file of await readdir(ui)) {
    if (!file.endsWith(".tsx")) continue;
    const source = await readFile(new URL(file, ui), "utf8");
    for (const match of source.matchAll(/<Term(?:Tip|Help) term="([^"]+)"/g)) used.add(match[1]);
    for (const match of source.matchAll(/"(target-(?:public|admin))"/g)) used.add(match[1]);
  }
  assert.ok(used.size >= 4, `found ${[...used]}`);
  for (const term of used) assert.ok(glossary[term]?.title && glossary[term]?.text, `missing glossary entry: ${term}`);
  for (const term of ["head", "weight", "stiffness", "pattern", "grip", "fit"]) assert.ok(glossary[term], term);
});

test("admin-only header controls stay hidden until the dashboard has loaded", async () => {
  const app = await readFile(new URL("../app/ui/BaselineApp.tsx", import.meta.url), "utf8");
  assert.match(app, /const adminView = data \? !data\.publicPreview : false;/);
  assert.match(app, /\{adminView && <button className="analytics-button"/);
});
