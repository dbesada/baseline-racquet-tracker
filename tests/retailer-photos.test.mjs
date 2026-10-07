import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { listingPhoto, pickRetailerPhotos } from "../app/lib/retailer-photos.js";

const origin = "https://atrsports.com/en-ca";

test("a listing photo prefers the matched variant's photo and asks Shopify for a larger copy", () => {
  const product = { images: [{ src: "https://cdn.shopify.com/s/files/1/0001/products/blade.jpg?v=1" }] };
  assert.equal(listingPhoto(product, { featured_image: { src: "https://cdn.shopify.com/s/files/1/0001/products/blade-l3.jpg?v=2" } }, origin),
    "https://cdn.shopify.com/s/files/1/0001/products/blade-l3.jpg?v=2&width=900");
  assert.equal(listingPhoto(product, { featured_image: null }, origin), "https://cdn.shopify.com/s/files/1/0001/products/blade.jpg?v=1&width=900");
  assert.equal(listingPhoto({ images: [{ src: "//atrsports.com/cdn/shop/files/blade.png" }] }, null, origin), "https://atrsports.com/cdn/shop/files/blade.png?width=900");
  assert.equal(listingPhoto({ images: [{ src: "https://images.example.ca/blade.jpg" }] }, null, origin), "https://images.example.ca/blade.jpg", "other hosts are left as they are");
});

test("special editions, missing photos and non-https photos are skipped", () => {
  const product = { images: [{ src: "https://cdn.shopify.com/s/files/1/0001/products/blade-noir.jpg" }] };
  assert.equal(listingPhoto(product, null, origin, true), null);
  assert.equal(listingPhoto({ images: [] }, null, origin), null);
  assert.equal(listingPhoto({ images: [{ src: "http://insecure.example/blade.jpg" }] }, null, origin), null);
  assert.equal(listingPhoto({ images: [{ src: "javascript:alert(1)" }] }, null, origin), null);
});

test("one photo per racquet, from the cheapest listing that has one", () => {
  const photos = pickRetailerPhotos([
    { modelKey: "blade-v9", store: "Tads", price: 289, url: "https://t/blade", imageUrl: "https://t/blade.jpg" },
    { modelKey: "blade-v9", store: "ATR Sports", price: 279, url: "https://a/blade", imageUrl: "https://a/blade.jpg" },
    { modelKey: "blade-v9", store: "Brown's", price: 249, url: "https://b/blade" },
    { modelKey: "ezone-98", store: "Just Tennis", price: 299, url: "https://j/ezone", imageUrl: "https://j/ezone.jpg" },
    { modelKey: "other-sale", store: "Max", price: 99, url: "https://m/x", imageUrl: "https://m/x.jpg" },
  ]);
  assert.deepEqual(photos, {
    "blade-v9": { url: "https://a/blade.jpg", store: "ATR Sports", pageUrl: "https://a/blade" },
    "ezone-98": { url: "https://j/ezone.jpg", store: "Just Tennis", pageUrl: "https://j/ezone" },
  });
});

test("the monitor saves listing photos and the page uses them only as a credited last resort", async () => {
  const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
  const [monitor, relay, insights, dialogs] = await Promise.all([read("scripts/check-prices.mjs"), read("scripts/baseline-relay.mjs"), read("app/ui/dashboard-insights.ts"), read("app/ui/RacquetDialogs.tsx")]);
  assert.match(monitor, /const photo = listingPhoto\(product, group\[0\]\?\.variant, origin, Boolean\(specialEditionName\(productName\)\)\);/);
  assert.match(monitor, /retailerPhotos: pickRetailerPhotos\(offers\),/);
  assert.match(relay, /dashboard\.retailerPhotos = state\.retailerPhotos \?\? \{\};/);
  assert.match(insights, /if \(existing\.imageUrl\?\.startsWith\("https:\/\/"\) \|\| modelImages\[modelKey\] \|\| !photo\?\.url\?\.startsWith\("https:\/\/"\)\) continue;/);
  assert.match(insights, /imageUrl: photo\.url, imageSource: photo\.store/);
  assert.match(dialogs, /Photo from \$\{spec\.imageSource\}’s product listing\./);
});
