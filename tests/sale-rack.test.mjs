import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isPreStrung, pickSaleOffers, saleTitle } from "../app/lib/sale-rack.js";

const offer = (title, currentPrice, compareAtPrice, extra = {}) => ({ id: `${title}:${currentPrice}`, modelKey: "other-sale", store: "Shop", title, currentPrice, compareAtPrice, ...extra });

test("tells pre-strung racquets from unstrung frames", () => {
  for (const title of ["Wilson Energy XL (Pre-Strung)", "Prince Hornet 100 (Black/Red, Pre-Strung)", "Yonex VCore Ace 98 Tennis Racquet Strung", "Head Tour Pro prestrung"]) assert.equal(isPreStrung(title), true, title);
  for (const title of ["Wilson Clash 98 V2.0 Tennis Racquet Unstrung", "Head Speed Team 2024", "Babolat Pure Strike Team Unstrung Tennis Racquet"]) assert.equal(isPreStrung(title), false, title);
});

test("keeps the cheapest listing per name, caps each kind, and stays sorted by price", () => {
  const offers = [
    offer("Wilson Energy XL (Pre-Strung)", 39.95, 59.95),
    offer("Wilson Energy XL (Pre-Strung)", 39.95, 59.95, { id: "dupe" }),
    offer("Head Tour Pro (Pre-Strung)", 29.95, 54.95),
    offer("Prince Bandit 100 (Pre-Strung)", 79.95, 149.95),
    offer("Head Speed Team 2024", 179, 249),
    offer("Wilson Clash 98 V2.0 Unstrung", 179.99, 320),
    offer("Not discounted", 100, 100),
    offer("Tracked racquet", 150, 200, { modelKey: "blade-v9" }),
  ];
  const picked = pickSaleOffers(offers, { preStrung: 2, unstrung: 5 });
  assert.deepEqual(picked.map((item) => item.title), ["Head Tour Pro (Pre-Strung)", "Wilson Energy XL (Pre-Strung)", "Head Speed Team 2024", "Wilson Clash 98 V2.0 Unstrung"]);
  assert.deepEqual(picked.map((item) => item.preStrung), [true, true, false, false]);
  const prices = picked.map((item) => item.currentPrice);
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
});

test("card names drop the words the tag and section already say", () => {
  assert.equal(saleTitle("Wilson Energy XL (Pre-Strung)"), "Wilson Energy XL");
  assert.equal(saleTitle("Prince Hornet 100 (Black/Red, Pre-Strung)"), "Prince Hornet 100 (Black/Red)");
  assert.equal(saleTitle("Yonex VCore Ace 98 260g Red-White Tennis Racquet Strung"), "Yonex VCore Ace 98 260g Red-White");
  assert.equal(saleTitle("WILSON CLASH 108 V2 TENNIS RACKET"), "WILSON CLASH 108 V2");
  assert.equal(saleTitle("Head Speed Team 2024"), "Head Speed Team 2024");
});

test("the relay sends the picked sale offers, and the racquet list loads more on scroll", async () => {
  const relay = await readFile(new URL("../scripts/baseline-relay.mjs", import.meta.url), "utf8");
  assert.match(relay, /dashboard\.saleOffers = pickSaleOffers\(offers\)/);
  const browser = await readFile(new URL("../app/ui/RacquetBrowser.tsx", import.meta.url), "utf8");
  assert.match(browser, /new IntersectionObserver/);
  assert.match(browser, /<button ref=\{moreButton\} className="catalogue-more"/);
});
