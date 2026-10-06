import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { affiliateConfigUrl, affiliateUrl, createAffiliateLinks, loadAffiliateLinks, validateAffiliateConfig } from "../scripts/affiliate-links.mjs";
import { createOutboundRedirect } from "../scripts/outbound-redirect.mjs";

const amazon = { retailer: "Amazon.ca", market: "CA", network: "amazon-associates", enabled: true, hosts: ["www.amazon.ca"], addParams: { tag: "baseline0a-20" } };
const wrapped = { retailer: "Sport Chek", market: "CA", network: "test-network", enabled: true, hosts: ["www.sportchek.ca"], linkTemplate: "https://click.network.test/c/123?u={url}" };
const config = (retailers, market = "CA") => ({ market, retailers });
const read = async (file) => JSON.parse(await readFile(new URL(`../${file}`, import.meta.url), "utf8"));

test("the shipped Canadian and U.S. files are valid and kept apart", async () => {
  for (const [file, market] of [["config/affiliates/ca.json", "CA"], ["config/affiliates/us.json", "US"]]) {
    const shipped = await read(file);
    assert.equal(shipped.market, market, file);
    assert.deepEqual(validateAffiliateConfig(shipped, market).errors, [], file);
    assert.ok(shipped.retailers.every((entry) => entry.market === market), `${file} holds another market's entry`);
  }
  assert.match(affiliateConfigUrl("CA").href, /\/config\/affiliates\/ca\.json$/);
  assert.match(affiliateConfigUrl("US").href, /\/config\/affiliates\/us\.json$/);
});

test("no affiliate link is switched on before the disclosure ships (Slice 3)", async () => {
  // Remove this test when the affiliate disclosure is live on the site.
  for (const file of ["config/affiliates/ca.json", "config/affiliates/us.json"]) {
    assert.deepEqual((await read(file)).retailers.filter((entry) => entry.enabled).map((entry) => entry.retailer), [], file);
  }
});

test("valid entries are accepted, by retailer name", () => {
  const { entries, errors } = validateAffiliateConfig(config([amazon, wrapped, { ...amazon, retailer: "Just Tennis", enabled: false, hosts: ["www.justtennis.ca"], addParams: { ref: "your-code" } }]), "CA");
  assert.deepEqual(errors, []);
  assert.deepEqual([...entries.keys()], ["Amazon.ca", "Sport Chek", "Just Tennis"]);
});

test("invalid entries are reported and left out, without dropping the good ones", () => {
  const bad = [
    { ...amazon, retailer: "Wrong market", market: "US" },
    { ...amazon, retailer: "No network", network: "" },
    { ...amazon, retailer: "No hosts", hosts: [] },
    { ...amazon, retailer: "Not boolean", enabled: "yes" },
    { ...amazon, retailer: "Both", linkTemplate: "https://x.test/?u={url}" },
    { retailer: "Neither", market: "CA", network: "n", enabled: false, hosts: ["a.test"] },
    { ...wrapped, retailer: "No url", linkTemplate: "https://click.network.test/c/123" },
    { ...wrapped, retailer: "Two urls", linkTemplate: "https://click.network.test/?a={url}&b={url}" },
    { ...wrapped, retailer: "Plain http", linkTemplate: "http://click.network.test/?u={url}" },
    { ...amazon, retailer: "Placeholder", addParams: { tag: "your-tag-20" } },
    { ...amazon, retailer: "Empty param", addParams: { tag: "" } },
    amazon,
    { ...amazon },
  ];
  const { entries, errors } = validateAffiliateConfig(config(bad), "CA");
  assert.deepEqual([...entries.keys()], ["Amazon.ca"]);
  assert.equal(errors.length, bad.length - 1);
  assert.ok(errors.some((error) => /Amazon\.ca is listed twice/.test(error)));
  assert.ok(errors.some((error) => /Placeholder is enabled but still has placeholder values/.test(error)));
  assert.deepEqual(validateAffiliateConfig(config([amazon], "US"), "CA").entries.size, 0, "a U.S. file is never used in Canada");
});

test("enabled entries build the affiliate link; everything else is the plain link", () => {
  const affiliate = createAffiliateLinks(validateAffiliateConfig(config([amazon, wrapped, { ...amazon, retailer: "Just Tennis", enabled: false, hosts: ["www.justtennis.ca"] }]), "CA").entries);
  assert.deepEqual(affiliate({ store: "Amazon.ca" }, "https://www.amazon.ca/dp/B0TEST1234"), { url: "https://www.amazon.ca/dp/B0TEST1234?tag=baseline0a-20", network: "amazon-associates" });
  assert.deepEqual(affiliate({ store: "Sport Chek" }, "https://www.sportchek.ca/p/racquet.html?colour=1"), {
    url: `https://click.network.test/c/123?u=${encodeURIComponent("https://www.sportchek.ca/p/racquet.html?colour=1")}`,
    network: "test-network",
  });
  const plain = (store, url) => assert.deepEqual(affiliate({ store }, url), { url, network: null }, store);
  plain("Just Tennis", "https://www.justtennis.ca/products/blade"); // disabled
  plain("ATR Sports", "https://atrsports.com/en-ca/products/blade"); // no entry
  plain("Amazon.ca", "https://www.amazon.com/dp/B0TEST1234"); // a host the entry does not cover
  plain("Amazon.ca", "http://www.amazon.ca/dp/B0TEST1234"); // would not be https
  assert.equal(affiliateUrl(amazon, "not a url"), null);
});

test("the redirect sends affiliate clicks to the affiliate link and logs the network", async () => {
  const folder = await mkdtemp(join(tmpdir(), "baseline-affiliate-"));
  const clickLogPath = join(folder, "clicks.jsonl");
  const state = { offers: {
    "Amazon.ca:B0TEST1234": { id: "Amazon.ca:B0TEST1234", store: "Amazon.ca", url: "https://www.amazon.ca/dp/B0TEST1234" },
    "ATR Sports:1": { id: "ATR Sports:1", store: "ATR Sports", url: "https://atrsports.com/en-ca/products/blade" },
  } };
  const { handleOutbound } = createOutboundRedirect({
    readState: async () => state,
    clickLogPath,
    affiliate: createAffiliateLinks(validateAffiliateConfig(config([amazon]), "CA").entries),
  });
  const go = async (id) => {
    let location = null;
    await handleOutbound({ method: "GET", url: `/go/${encodeURIComponent(id)}`, headers: {} }, { writeHead(status, headers) { location = headers?.location; }, end() {} });
    return location;
  };
  assert.equal(await go("Amazon.ca:B0TEST1234"), "https://www.amazon.ca/dp/B0TEST1234?tag=baseline0a-20");
  assert.equal(await go("ATR Sports:1"), "https://atrsports.com/en-ca/products/blade");
  const rows = (await readFile(clickLogPath, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(rows.map((row) => [row.retailer, row.network]), [["Amazon.ca", "amazon-associates"], ["ATR Sports", null]]);
});

test("a missing or broken file means plain links, with a warning", async () => {
  const folder = await mkdtemp(join(tmpdir(), "baseline-affiliate-"));
  const warnings = [];
  const missing = await loadAffiliateLinks({ market: "CA", url: pathToFileURL(join(folder, "missing.json")), warn: (message) => warnings.push(message) });
  assert.deepEqual(missing({ store: "Amazon.ca" }, "https://www.amazon.ca/dp/B0TEST1234"), { url: "https://www.amazon.ca/dp/B0TEST1234", network: null });
  const file = join(folder, "ca.json");
  await writeFile(file, JSON.stringify(config([amazon, { ...amazon, retailer: "Broken", hosts: [] }])));
  const partial = await loadAffiliateLinks({ market: "CA", url: pathToFileURL(file), warn: (message) => warnings.push(message) });
  assert.equal(partial({ store: "Amazon.ca" }, "https://www.amazon.ca/dp/B0TEST1234").network, "amazon-associates");
  assert.equal(warnings.length, 2);
  assert.match(warnings[0], /Affiliate links are off/);
  assert.match(warnings[1], /Affiliate entry skipped: Broken needs hosts/);
});

test("the relay reads only its own market's file, and the image ships it", async () => {
  const relay = await readFile(new URL("../scripts/baseline-relay.mjs", import.meta.url), "utf8");
  assert.match(relay, /const market = marketFrom\(process\.env\.BASELINE_MARKET\);/);
  assert.match(relay, /loadAffiliateLinks\(\{ market,/);
  assert.match(relay, /createOutboundRedirect\(\{[\s\S]*?\baffiliate,[\s\S]*?\}\);/);
  assert.doesNotMatch(relay, /affiliates\/us\.json|affiliates\/ca\.json/, "the file must be chosen by market, not hard-coded");
  const dockerignore = (await readFile(new URL("../.dockerignore", import.meta.url), "utf8")).split(/\r?\n/).map((line) => line.trim());
  assert.ok(!dockerignore.some((line) => /^\/?config\/?/.test(line)), ".dockerignore must not leave the affiliate files out of the image");
});
