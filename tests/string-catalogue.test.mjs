import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("classifies tennis strings by construction, gauge, and package format", async () => {
  const monitor = await readFile(new URL("../scripts/check-prices.mjs", import.meta.url), "utf8");
  const start = monitor.indexOf("const stringGaugeOrder =");
  const end = monitor.indexOf("\nasync function fetchStringStore", start);
  assert.ok(start >= 0 && end > start);
  const helpers = Function(`${monitor.slice(start, end)}; return { stringBrand, stringGauges, stringType, stringFormat, isTennisStringProduct };`)();

  const examples = [
    ["Babolat RPM Blast 16g/1.30mm - String Reel", "Polyester", ["16"], "Reel"],
    ["Head Velocity MLT 17 / 1.25mm Set", "Multifilament", ["17"], "Set"],
    ["Wilson Natural Gut 16 Gauge", "Natural gut", ["16"], "Single package"],
    ["Prince Synthetic Gut Duraflex 16g", "Synthetic gut", ["16"], "Single package"],
    ["Wilson Champion's Choice Duo Hybrid 16L/17", "Hybrid", ["16L", "17"], "Single package"],
    ["Luxilon Alu Power Rough 125 Reel Monofilament", "Polyester", ["17"], "Reel"],
    ["Babolat RPM Rough 17 Tennis String Reel", "Polyester", ["17"], "Reel"],
    ["Luxilon ALU Power Half Set 6.1m", "Polyester", [], "Half set"],
    ["Tecnifibre X-One Biphase 12.2m Full Set", "Multifilament", [], "Set"],
  ];
  for (const [title, type, gauges, format] of examples) {
    assert.equal(helpers.stringType(title), type, title);
    assert.deepEqual(helpers.stringGauges(title), gauges, title);
    assert.equal(helpers.stringFormat(title), format, title);
    assert.equal(helpers.isTennisStringProduct({ title }), true, title);
  }
  assert.equal(helpers.isTennisStringProduct({ title: "Yonex BG80 Badminton String Reel" }), false);
  assert.equal(helpers.isTennisStringProduct({ title: "Professional Stringing Machine" }), false);
  assert.equal(helpers.isTennisStringProduct({ title: "Thrive Fury Hybrid 15.5mm Pickleball String" }), false);
  assert.equal(helpers.stringBrand("HEAD"), "Head");
  assert.equal(helpers.stringBrand("VÖLKL"), "Volkl");
  assert.equal(helpers.stringBrand("ReString"), "ReString");
  assert.equal(helpers.stringBrand("Just Tennis", "Luxilon ALU Power 16L Reel"), "Luxilon");
  assert.equal(helpers.stringBrand("Premier Racquet Clubs", "Yonex Poly Tour Pro 16L Set"), "Yonex");
  assert.equal(helpers.stringBrand("Babolat Canada", "RPM Blast 16 Reel"), "Babolat");
});

test("uses a broad set of live Canadian string catalogues", async () => {
  const monitor = await readFile(new URL("../scripts/check-prices.mjs", import.meta.url), "utf8");
  const start = monitor.indexOf("const stringFeeds =");
  const end = monitor.indexOf("\n];", start);
  const feeds = monitor.slice(start, end);
  const stores = [...feeds.matchAll(/\["([^"]+)",\s*"https:/g)].map((match) => match[1]);
  assert.equal(new Set(stores).size, 19);
  for (const store of ["ATR Sports", "Merchant of Tennis", "T1 Sports", "Tennis Giant", "Tenniszon"]) {
    assert.ok(stores.includes(store), store);
  }
});
