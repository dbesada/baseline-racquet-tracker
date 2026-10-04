import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { classify, classifyUsed, isAccessory, jsonLdOffer, parseAmazonPrice, productJsonLd } from "../app/lib/catalog-matching.js";

test("the API and the price monitor share one copy of the matching rules", async () => {
  const [route, monitor] = await Promise.all([
    readFile(new URL("../app/api/tracker/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/check-prices.mjs", import.meta.url), "utf8"),
  ]);
  for (const [name, source] of [["route.ts", route], ["check-prices.mjs", monitor]]) {
    assert.match(source, /from "[./]+(?:app\/)?lib\/catalog-matching\.js"/, `${name} imports the shared module`);
    assert.doesNotMatch(source, /\nfunction (?:classify|classifyUsed|productJsonLd|jsonLdOffer)\(/, `${name} has no private copy`);
  }
});

test("a plus sign at the end of a title still matches the Plus model", () => {
  // The API's old copy required a letter after "+", so it missed these titles.
  assert.equal(classify("Babolat Pure Aero +"), "pure-aero-plus");
  assert.equal(classify("Babolat Pure Drive +"), "pure-drive-plus");
  assert.equal(classify("Babolat Pure Drive Plus"), "pure-drive-plus");
});

test("used listings are matched, but pro stock and replicas are not", () => {
  assert.equal(classifyUsed("Used Wilson Blade 98 18x20 v9"), "blade-98-18x20-v9");
  assert.equal(classifyUsed("Wilson Blade 98 pro stock"), null);
  assert.equal(isAccessory("Wilson Blade racquet cover"), true);
});

test("retailer page helpers read prices and structured offers", () => {
  assert.equal(parseAmazonPrice('<span class="a-offscreen">$249.99</span>'), 249.99);
  assert.equal(parseAmazonPrice('<span class="a-price-whole">1,249</span><span class="a-price-fraction">50</span>'), 1249.5);
  const html = '<script type="application/ld+json">{"@graph":[{"@type":"Product","name":"Blade","offers":[null,{"availability":"OutOfStock","price":1},{"availability":"https://schema.org/InStock","price":2}]}]}</script>';
  const [product] = productJsonLd(html);
  assert.equal(product.name, "Blade");
  assert.equal(jsonLdOffer(product).price, 2);
  assert.deepEqual(productJsonLd('<script type="application/ld+json">{"itemListElement":[null]}</script>'), []);
});
