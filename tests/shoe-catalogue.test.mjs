import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { catalogueDashboard, mergeMonitorState } from "../scripts/dashboard-build.mjs";
import { listKinds, offerLists } from "../scripts/outbound-rules.mjs";

const monitorSource = () => readFile(new URL("../scripts/check-prices.mjs", import.meta.url), "utf8");

async function shoeHelpers() {
  const monitor = await monitorSource();
  const start = monitor.indexOf("const shoeCourtOrder =");
  const end = monitor.indexOf("\nasync function fetchShoeStore", start);
  assert.ok(start >= 0 && end > start);
  return Function(`${monitor.slice(start, end)}; return { isTennisShoeProduct, tennisShoeGender, tennisShoeCourt, tennisShoeSize, shoeBrand };`)();
}

test("keeps tennis shoes and leaves out other footwear and accessories", async () => {
  const { isTennisShoeProduct } = await shoeHelpers();
  assert.equal(isTennisShoeProduct({ title: "Asics Gel Resolution 9 Men's Tennis Shoe" }), true);
  assert.equal(isTennisShoeProduct({ title: "Adidas Barricade 13", product_type: "Tennis Shoes" }), true);
  assert.equal(isTennisShoeProduct({ title: "Babolat Jet Mach 3 All Court" }, "https://example.ca/collections/tennis-shoes/products.json"), true);
  assert.equal(isTennisShoeProduct({ title: "K-Swiss Express Light 3 Tennis/Pickleball Shoe" }), true);
  assert.equal(isTennisShoeProduct({ title: "Head Motion Pro Padel Shoe" }), false);
  assert.equal(isTennisShoeProduct({ title: "Selkirk Pickleball Court Shoe" }), false);
  assert.equal(isTennisShoeProduct({ title: "Asics Gel Kayano Running Shoe", tags: "tennis" }), false);
  assert.equal(isTennisShoeProduct({ title: "Wilson Tennis Socks 3 Pack", product_type: "Shoes" }), false);
  assert.equal(isTennisShoeProduct({ title: "Babolat Shoe Bag", tags: "tennis shoes" }), false);
  assert.equal(isTennisShoeProduct({ title: "Lacoste Men's Serve Slide 0.0 Strap" }, "https://www.merchantoftennis.com/collections/tennis-shoes/products.json"), false, "slides filed under tennis shoes");
  assert.equal(isTennisShoeProduct({ title: "Wilson Blade 98 v9", product_type: "Racquet" }), false);
});

test("trusts dedicated tennis-shoe catalogues but still drops other sports", async () => {
  const { isTennisShoeProduct } = await shoeHelpers();
  const justTennis = "https://www.justtennis.ca/collections/shoes/products.json?limit=250";
  assert.equal(isTennisShoeProduct({ title: "Babolat SFX 4 Men's", product_type: "Mens Shoes" }, justTennis, true), true, "a tennis store's own shoe catalogue");
  assert.equal(isTennisShoeProduct({ title: "Babolat SFX 4 Men's", product_type: "Mens Shoes" }, justTennis, false), false, "a mixed catalogue needs the word tennis");
  assert.equal(isTennisShoeProduct({ title: "Hypercourt Express 3 Clay" }, "https://www.tennisgiant.com/collections/tennis-mens-footwear/products.json"), true, "the catalogue path names tennis footwear");
  assert.equal(isTennisShoeProduct({ title: "Yonex Power Cushion SHB 65Z Men's Indoor", product_type: "Shoes", tags: "badminton" }, justTennis, true), false);
  assert.equal(isTennisShoeProduct({ title: "Brooks Ghost 16 Running Shoe" }, "https://racketsandrunners.ca/collections/shoes/products.json"), false);
});

test("reads fit and court type only when the listing says so", async () => {
  const { tennisShoeGender, tennisShoeCourt } = await shoeHelpers();
  assert.equal(tennisShoeGender("Asics Gel Resolution 9 Women's"), "Women's");
  assert.equal(tennisShoeGender("Nike Vapor Pro 2 Mens Tennis Shoe"), "Men's");
  assert.equal(tennisShoeGender("Babolat Propulse Junior"), "Junior");
  assert.equal(tennisShoeGender("Head Sprint Pro 3.5"), "Not listed");
  assert.equal(tennisShoeCourt("Adidas Barricade Clay"), "Clay court");
  assert.equal(tennisShoeCourt("Babolat Jet Mach 3 All Court"), "All court");
  assert.equal(tennisShoeCourt("Asics Solution Speed FF 3 AC"), "All court");
  assert.equal(tennisShoeCourt("Wilson Rush Pro 4.0 Hard Court"), "Hard court");
  assert.equal(tennisShoeCourt("Yonex Power Cushion Eclipsion 5"), "Not listed");
});

test("turns size labels into North American sizes", async () => {
  const { tennisShoeSize } = await shoeHelpers();
  assert.equal(tennisShoeSize("9"), "9");
  assert.equal(tennisShoeSize("10.5"), "10.5");
  assert.equal(tennisShoeSize("9½"), "9.5");
  assert.equal(tennisShoeSize("US 11"), "11");
  assert.equal(tennisShoeSize("8.5 US / 42 EU"), "8.5");
  assert.equal(tennisShoeSize("M9 / W10.5", "Men's"), "9");
  assert.equal(tennisShoeSize("M9 / W10.5", "Women's"), "10.5");
  assert.equal(tennisShoeSize("7.0 Men's / 8.5 Women's", "Men's"), "7");
  assert.equal(tennisShoeSize("7.0 Men's / 8.5 Women's", "Women's"), "8.5");
  assert.equal(tennisShoeSize("10 2E"), "10 Wide");
  assert.equal(tennisShoeSize("9 Wide"), "9 Wide");
  assert.equal(tennisShoeSize("4Y"), "4Y");
  assert.equal(tennisShoeSize("13 C"), "13Y");
  assert.equal(tennisShoeSize("EU 42"), "EU 42", "EU-only sizes are kept as written, not converted");
  assert.equal(tennisShoeSize("Default Title"), null);
  assert.equal(tennisShoeSize(""), null);
});

test("names the shoe brand from the vendor or title", async () => {
  const { shoeBrand } = await shoeHelpers();
  assert.equal(shoeBrand("ASICS Canada", "Gel Resolution 9"), "Asics");
  assert.equal(shoeBrand("", "New Balance 996v5 Tennis Shoe"), "New Balance");
  assert.equal(shoeBrand("Le Coq Sportif", "Futur Lite"), "Le Coq Sportif");
});

test("builds listings from store data: fit priority, wide models, court type and stock", async () => {
  const monitor = await monitorSource();
  const start = monitor.indexOf("const shoeCourtOrder =");
  const helpers = monitor.slice(start, monitor.indexOf("\nasync function fetchStore", start));
  const products = [
    { title: "Yonex Power Cushion Sonicage 3 Men's Tennis All Court Shoe", handle: "sonicage-3-m", vendor: "Yonex", product_type: "Men's Tennis Shoes", tags: "Men's Tennis Shoes Clay Courts, Women's Tennis Shoes", options: [{ name: "Size" }],
      variants: [{ id: 1, option1: "8.0 Men's / 9.5 Women's", price: "189.99", available: true }, { id: 2, option1: "9.0 Men's / 10.5 Women's", price: "189.99", available: false }] },
    { title: "Asics Men's Gel-Resolution X - 2E Width - Greige/Soft Oat", handle: "gel-res-x-2e", vendor: "ASICS", product_type: "M Shoe", tags: "clay-court", options: [{ name: "Colour" }, { name: "Size" }],
      variants: [{ id: 3, option1: "Greige", option2: "10", price: "219.99", compare_at_price: "239.99", available: true }] },
    { title: "Hypercourt Express 3", handle: "hce3", vendor: "K-Swiss", product_type: "Shoes", tags: "", options: [{ name: "Size" }],
      variants: [{ id: 4, option1: "9", price: "170", available: false }] },
    { title: "Babolat Propulse Junior", handle: "propulse-jr", vendor: "Babolat", product_type: "Shoes", tags: "", options: [{ name: "Size" }],
      variants: [{ id: 5, option1: "4", price: "89.99", available: true }, { id: 6, option1: "13.5", price: "79.99", available: true }] },
    { title: "New Balance 996 v6 Wide Junior Tennis Shoe (Clementine)", handle: "nb-996-jr-wide", vendor: "New Balance", product_type: "Shoes", tags: "", options: [{ name: "Size" }],
      variants: [{ id: 7, option1: "11", price: "99.99", available: true }] },
  ];
  const { fetchShoeStore } = Function("fetchShopifyCatalogs", `${helpers}\nreturn { fetchShoeStore };`)(async () => products);
  const offers = await fetchShoeStore(["Store", "https://store.example", "https://store.example/collections/tennis-womens-footwear/products.json"]);
  assert.equal(offers.length, 4, "a shoe with no size in stock is left out");
  const [sonicage, resolution, junior, juniorWide] = offers;
  assert.deepEqual(junior.sizes.map((entry) => entry.size), ["4Y", "13.5Y"], "junior shoes use youth sizes");
  assert.deepEqual(juniorWide.sizes.map((entry) => entry.size), ["11Y Wide"]);
  assert.equal(sonicage.gender, "Men's", "the title wins over tags that name both fits, and over the catalogue name");
  assert.equal(sonicage.court, "All court", "court type comes from the title");
  assert.deepEqual(sonicage.sizes, [{ size: "8", price: 189.99, compareAtPrice: null }]);
  assert.equal(resolution.court, "Not listed", "a clay-court tag alone is not trusted");
  assert.deepEqual(resolution.sizes, [{ size: "10 Wide", price: 219.99, compareAtPrice: 239.99 }], "every size of a 2E model is wide");
  assert.equal(resolution.brand, "Asics");
  assert.equal(resolution.id, "shoe:Store:gel-res-x-2e");
});

test("uses multiple Canadian tennis-shoe catalogues", async () => {
  const monitor = await monitorSource();
  const start = monitor.indexOf("const shoeFeeds =");
  const feeds = monitor.slice(start, monitor.indexOf("\n];", start));
  const stores = [...feeds.matchAll(/\["([^"]+)",\s*"https:/g)].map((match) => match[1]);
  assert.ok(new Set(stores).size >= 10);
  for (const store of ["Merchant of Tennis", "Sports Virtuoso", "RacquetGuys", "Tennis Giant", "Just Tennis"]) assert.ok(stores.includes(store), store);
});

test("records one listing per shoe per store with the sizes in stock", async () => {
  const monitor = await monitorSource();
  const start = monitor.indexOf("async function fetchShoeStore");
  const body = monitor.slice(start, monitor.indexOf("\nasync function fetchStore", start));
  assert.match(body, /id: `shoe:\$\{store\}:\$\{product\.handle\}`/);
  assert.match(body, /if \(!variant\.available \|\| !Number\.isFinite\(price\) \|\| price <= 0\) continue;/, "out-of-stock sizes are dropped");
  assert.match(body, /sizes: sizeList/);
  assert.match(monitor, /shoeOffers,\s*\r?\n\s*shoeSourceResults,/);
  assert.match(monitor, /staleFallback\(previous\.shoeOffers \?\? \[\], failedShoeStores/);
});

test("shoes reach the dashboard and go through the /go/ redirect", () => {
  const dashboard = mergeMonitorState(catalogueDashboard(true), {
    checkedAt: "2026-11-15T12:00:00.000Z",
    shoeOffers: [{ id: "shoe:Store:gel-res", store: "Store", title: "Asics Gel Resolution 9", url: "https://store.example/products/gel-res", price: 159.99, compareAtPrice: 199.99, brand: "Asics", gender: "Men's", court: "All court", sizes: [{ size: "9", price: 159.99, compareAtPrice: 199.99 }] }],
    shoeSourceResults: [{ store: "Store", ok: true, offers: 1 }],
  });
  assert.equal(dashboard.shoeOffers.length, 1);
  assert.deepEqual(dashboard.shoeOffers[0].sizes, [{ size: "9", price: 159.99, compareAtPrice: 199.99 }]);
  assert.equal(dashboard.shoeOffers[0].currentPrice, 159.99);
  assert.ok(offerLists.includes("shoeOffers"));
  assert.equal(listKinds.shoeOffers, "shoe");
});
