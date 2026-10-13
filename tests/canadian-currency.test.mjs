import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// check-prices.mjs runs a price check when imported, so the helper is read
// from its source (it uses nothing outside itself).
const source = await readFile(new URL("../scripts/check-prices.mjs", import.meta.url), "utf8");
const helper = source.slice(source.indexOf("export function inCanadianDollars"), source.indexOf("async function resilientFetch")).replace("export ", "");
const inCanadianDollars = Function(`${helper}; return inCanadianDollars;`)();

test("store product and collection requests ask for Canadian dollars", () => {
  const [url, init] = inCanadianDollars("https://tadssportinggoods.ca/collections/tennis-rackets/products.json?limit=250", { headers: { accept: "application/json" } });
  assert.equal(url, "https://tadssportinggoods.ca/collections/tennis-rackets/products.json?limit=250&currency=CAD");
  assert.equal(init.headers.get("cookie"), "localization=CA; cart_currency=CAD");
  assert.equal(init.headers.get("accept"), "application/json");
  assert.equal(inCanadianDollars("https://www.performancetennis.ca/products.json?limit=250")[0], "https://www.performancetennis.ca/products.json?limit=250&currency=CAD");
  assert.equal(inCanadianDollars("https://shop.example/products/blade-98")[0], "https://shop.example/products/blade-98?currency=CAD");
});

test("APIs and other requests are left alone", () => {
  for (const url of ["https://www.amazon.ca/s?k=blade", "https://api.ebay.com/buy/browse/v1/item_summary/search?q=x", "https://api.apify.com/v2/acts/x/runs", "http://localhost:3000/api/tracker", "not a url"]) {
    const init = { headers: { accept: "x" } };
    assert.deepEqual(inCanadianDollars(url, init), [url, init], url);
  }
});

test("every store request goes through the helper", () => {
  assert.match(source, /async function resilientFetch\(rawInput, rawInit = \{\}\) \{\r?\n  const \[input, init\] = inCanadianDollars\(rawInput, rawInit\);/);
  assert.match(source, /const fetch = resilientFetch;/);
});
