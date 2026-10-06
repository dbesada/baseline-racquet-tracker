import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { affiliateDisclosurePath, hasAffiliateLinks } from "../app/ui/affiliate-disclosure.js";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("the disclosure shows only while a retailer link earns a commission", () => {
  assert.equal(hasAffiliateLinks({ affiliateRetailers: ["Amazon.ca"] }), true);
  for (const data of [null, undefined, {}, { affiliateRetailers: [] }, { affiliateRetailers: "Amazon.ca" }]) {
    assert.equal(hasAffiliateLinks(data), false, JSON.stringify(data));
  }
});

test("the note is short, links to the disclosure page and hides itself when off", async () => {
  const note = await read("app/ui/AffiliateNote.tsx");
  assert.match(note, /if \(!show\) return null;/);
  assert.match(note, /Some retailer links earn Baseline a commission\. Prices and rankings are never affected\./);
  assert.match(note, /href=\{affiliateDisclosurePath\}/);
  assert.equal(affiliateDisclosurePath, "/affiliate-disclosure");
});

test("the note sits near prices in every agreed place, and the footer links the page", async () => {
  const [app, hero, dialogs, used, coach] = await Promise.all([
    read("app/ui/BaselineApp.tsx"), read("app/ui/RetailHero.tsx"), read("app/ui/RacquetDialogs.tsx"), read("app/ui/UsedMarket.tsx"), read("app/ui/BaselineCoach.tsx"),
  ]);
  assert.match(app, /const affiliateLinksOn = hasAffiliateLinks\(data\);/);
  assert.match(app, /<\/div>\s*<AffiliateNote show=\{affiliateLinksOn && activeBrand !== "guide"\} \/>/, "under the shared browse heading");
  assert.match(app, /affiliateLinksOn=\{affiliateLinksOn\}/, "passed to Baseline Coach");
  assert.match(app, /\{affiliateLinksOn && <> <a className="footer-disclosure" href=\{affiliateDisclosurePath\}>Affiliate disclosure<\/a><\/>\}/, "footer link only while on");
  assert.match(hero, /className="last-check">[\s\S]*?<\/span>\s*<\/div>\s*<AffiliateNote show=\{hasAffiliateLinks\(data\)\} \/>/, "beside the Best opportunity card, outside its fixed-size panel");
  assert.match(dialogs, /ranked by price<\/p><AffiliateNote show=\{hasAffiliateLinks\(data\)\} \/>/, "in the All retailers pop-up");
  assert.match(used, /verified<\/div>\s*<\/div>\s*<AffiliateNote show=\{hasAffiliateLinks\(data\)\} \/>/, "under the used-market heading");
  assert.match(coach, /affiliateLinksOn = false/);
  assert.match(coach, /<AffiliateNote show=\{affiliateLinksOn\} \/>\s*\{showModels &&/, "above the Coach picks");
});

test("the disclosure page explains commissions, ranking, links and records", async () => {
  await access(new URL("../app/affiliate-disclosure/page.tsx", import.meta.url));
  const page = await read("app/affiliate-disclosure/page.tsx");
  assert.match(page, /className="legal-page"/);
  assert.match(page, /You pay the same price either way\./);
  assert.match(page, /Baseline ranks deals by price, or by the view you choose[^.]*\. Whether a retailer pays a commission never changes the order of results/);
  assert.match(page, /starts with \/go\//);
  assert.match(page, /does not record your IP address, device identifiers or an account/);
  assert.match(page, /up to 90 days/);
  assert.match(page, /href="\/privacy"/);
});

test("the privacy page describes click records and links the disclosure", async () => {
  const privacy = await read("app/privacy/page.tsx");
  assert.match(privacy, /records the time, the listing, the retailer, the market and the affiliate network, if any/);
  assert.match(privacy, /do not include accounts, names, IP addresses or device identifiers, and are kept for up to 90 days/);
  assert.match(privacy, /href="\/affiliate-disclosure"/);
});
