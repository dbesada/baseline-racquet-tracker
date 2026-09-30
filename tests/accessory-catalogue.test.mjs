import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("classifies tennis accessories by useful shopping category and package detail", async () => {
  const monitor = await readFile(new URL("../scripts/check-prices.mjs", import.meta.url), "utf8");
  const start = monitor.indexOf("const accessoryCategoryOrder =");
  const end = monitor.indexOf("\nasync function fetchAccessoryStore", start);
  assert.ok(start >= 0 && end > start);
  const helpers = Function(`${monitor.slice(start, end)}; return { accessoryCategory, accessoryBrand, accessoryDetail, isTennisAccessoryProduct };`)();

  const examples = [
    ["Wilson Pro Overgrip 12 Pack", "Overgrips", "12-pack"],
    ["HEAD Hydrosorb Pro Replacement Grip", "Replacement grips", "Single item"],
    ["Yonex VCORE 98 Grommet Set", "Grommets & bumpers", "Replacement set"],
    ["Babolat Custom Dampener 2 Pack", "Dampeners", "2-pack"],
    ["Tecnifibre Tour Endurance 12 Racquet Bag", "Racquet bags", "12-racquet"],
    ["Tourna Lead Tape 36 g", "Customization", "36 g"],
    ["Babolat Balancer Tape (3)", "Customization", "Single item"],
    ["Gamma Head Guard Tape", "Racquet care", "Single item"],
  ];
  for (const [title, category, detail] of examples) {
    assert.equal(helpers.accessoryCategory(title), category, title);
    assert.equal(helpers.accessoryDetail(title, category), detail, title);
    assert.equal(helpers.isTennisAccessoryProduct({ title }), true, title);
  }

  for (const title of ["Yonex BG80 Badminton Overgrip", "Pickleball Paddle Cover", "Babolat Tennis String Reel", "Wilson Tennis Balls 3 Pack", "Head Sprint Pro Tennis Shoes"]) {
    assert.equal(helpers.isTennisAccessoryProduct({ title }), false, title);
  }
  assert.equal(helpers.accessoryBrand("HEAD"), "Head");
  assert.equal(helpers.accessoryBrand("Babolat Canada"), "Babolat");
  assert.equal(helpers.accessoryBrand("Just Tennis", "Yonex Super Grap Overgrip"), "Yonex");
  assert.equal(helpers.isTennisAccessoryProduct({ title: "Tecnifibre Tour Endurance RS 12", product_type: "Bags", tags: "tennis,badminton,squash" }, "https://racquetscience.ca/collections/bags/products.json"), true);
  assert.equal(helpers.accessoryCategory("Tecnifibre Tour Endurance RS 12 Bags tennis"), "Racquet bags");
});

test("uses broad live Canadian accessory catalogues", async () => {
  const monitor = await readFile(new URL("../scripts/check-prices.mjs", import.meta.url), "utf8");
  const start = monitor.indexOf("const accessoryFeeds =");
  const end = monitor.indexOf("\n];", start);
  const feeds = monitor.slice(start, end);
  const stores = [...feeds.matchAll(/\["([^"]+)",\s*"https:/g)].map((match) => match[1]);
  assert.equal(new Set(stores).size, 16);
  assert.ok(stores.length >= 30);
  for (const store of ["ATR Sports", "Merchant of Tennis", "Racquet Science", "Tennis Giant", "Tenniszon", "TennisNetPro"]) {
    assert.ok(stores.includes(store), store);
  }
});
