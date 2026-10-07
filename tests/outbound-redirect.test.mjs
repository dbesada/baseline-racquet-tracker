import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createOutboundRedirect, marketFrom, offerIdFromPath } from "../scripts/outbound-redirect.mjs";

// One offer of every kind the monitor writes, with IDs shaped like the real ones.
const state = {
  offers: {
    "Brown's Sports:123": { id: "Brown's Sports:123", store: "Brown's Sports", url: "https://www.brownssports.ca/products/blade-98" },
    "Amazon.ca:B0TEST": { id: "Amazon.ca:B0TEST", store: "Amazon.ca", url: "https://www.amazon.ca/dp/B0TEST" },
  },
  specialOffers: [{ id: "ATR Sports:pure-aero-rafa:pure-aero-98", store: "ATR Sports", url: "https://atrsports.com/en-ca/products/rafa" }],
  usedOffers: [{ id: "used:ebay:v1|123|0", store: "eBay Canada", url: "https://www.ebay.ca/itm/123" }],
  stringOffers: [{ id: "string:Just Tennis:rpm-blast:set", store: "Just Tennis", url: "https://www.justtennis.ca/products/rpm-blast" }],
  accessoryOffers: [{ id: "accessory:Tads Sporting Goods:overgrip", store: "Tads Sporting Goods", url: "https://tadssportinggoods.ca/products/overgrip" }],
  ballOffers: [{ id: "ball:RacquetGuys:pro-tour:4-ball", store: "RacquetGuys", url: "https://racquetguys.ca/products/pro-tour" }],
};
const everyOffer = [...Object.values(state.offers), ...["specialOffers", "usedOffers", "stringOffers", "accessoryOffers", "ballOffers"].flatMap((list) => state[list])];

async function setup(options = {}) {
  const folder = await mkdtemp(join(tmpdir(), "baseline-go-"));
  const clickLogPath = join(folder, "clicks.jsonl");
  const { handleOutbound, rememberOffers } = createOutboundRedirect({ readState: async () => options.state ?? state, clickLogPath, ...options });
  const call = async (url, { method = "GET", headers = {} } = {}) => {
    const response = { status: 0, headers: {}, body: "" };
    await handleOutbound({ method, url, headers }, {
      writeHead(status, responseHeaders = {}) { response.status = status; response.headers = responseHeaders; },
      end(body) { response.body = body ?? ""; },
    });
    return response;
  };
  const clicks = async () => {
    try { return (await readFile(clickLogPath, "utf8")).trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)); }
    catch { return []; }
  };
  return { call, clicks, clickLogPath, folder, rememberOffers };
}

const goPath = (id) => `/go/${encodeURIComponent(id)}`;

test("every kind of offer redirects to the URL the link used to open", async () => {
  const { call } = await setup();
  for (const offer of everyOffer) {
    const response = await call(goPath(offer.id));
    assert.equal(response.status, 302, offer.id);
    assert.equal(response.headers.location, offer.url, offer.id);
    assert.equal(response.headers["cache-control"], "no-store");
  }
});

test("every offer in the local monitor snapshot redirects to its own URL", { skip: !existsSync(new URL("../.data/baseline-monitor.json", import.meta.url)) && "no local snapshot" }, async () => {
  const snapshot = JSON.parse(await readFile(new URL("../.data/baseline-monitor.json", import.meta.url), "utf8"));
  const { call } = await setup({ state: snapshot });
  const offers = [...Object.values(snapshot.offers ?? {}), ...["specialOffers", "usedOffers", "stringOffers", "accessoryOffers", "ballOffers"].flatMap((list) => snapshot[list] ?? [])];
  for (const offer of offers) {
    const response = await call(goPath(offer.id));
    assert.equal(response.headers.location, new URL(offer.url).href, offer.id);
  }
});

test("unknown, malformed and URL-carrying requests get 404 and are not logged", async () => {
  const { call, clicks } = await setup({ state: { ...state, offers: { ...state.offers, bad: { id: "bad", store: "X", url: "javascript:alert(1)" } } } });
  for (const url of [
    "/go/nope",
    "/go/",
    "/go/bad",
    "/go/%E0%A4%A",
    `/go/${encodeURIComponent("Brown's Sports:123")}?url=https://evil.example`,
    `/go/${encodeURIComponent("Brown's Sports:123")}/https://evil.example`,
    `/go/${encodeURIComponent("https://evil.example")}`,
  ]) {
    assert.equal((await call(url)).status, 404, url);
  }
  assert.deepEqual(await clicks(), []);
  assert.equal((await call(goPath("Brown's Sports:123"), { method: "POST" })).status, 405);
});

test("before the first price check every ID is unknown, and the 404 leads back home", async () => {
  const { call } = await setup({ readState: async () => { throw new Error("ENOENT"); } });
  const response = await call(goPath("Brown's Sports:123"));
  assert.equal(response.status, 404);
  assert.match(response.headers["content-type"], /text\/html/);
  assert.match(response.body, /no longer listed/);
  assert.match(response.body, /<a href="\/">Back to Baseline<\/a>/);
});

test("a link on a page loaded before a price check still reaches the retailer", async () => {
  let clock = Date.parse("2026-10-05T12:00:00Z");
  let current = state;
  const { call, rememberOffers } = await setup({ readState: async () => current, now: () => clock });
  rememberOffers(state); // The relay does this whenever it serves the dashboard.
  current = { offers: {} }; // The next check finds the racquet sold out.
  const soldOut = await call(goPath("Brown's Sports:123"));
  assert.equal(soldOut.status, 302);
  assert.equal(soldOut.headers.location, "https://www.brownssports.ca/products/blade-98");
  current = { offers: { "Brown's Sports:123": { id: "Brown's Sports:123", store: "Brown's Sports", url: "https://www.brownssports.ca/products/blade-98-v2" } } };
  assert.equal((await call(goPath("Brown's Sports:123"))).headers.location, "https://www.brownssports.ca/products/blade-98-v2", "the current URL wins");
  current = { offers: {} };
  clock += 8 * 24 * 60 * 60 * 1000;
  assert.equal((await call(goPath("Brown's Sports:123"))).status, 404, "forgotten after a week");
});

test("a click while the monitor is rewriting the state file still redirects", async () => {
  let broken = false;
  const { call, rememberOffers } = await setup({ readState: async () => { if (broken) throw new SyntaxError("Unexpected end of JSON input"); return state; } });
  rememberOffers(state);
  broken = true;
  const response = await call(goPath("ball:RacquetGuys:pro-tour:4-ball"));
  assert.equal(response.status, 302);
  assert.equal(response.headers.location, "https://racquetguys.ca/products/pro-tour");
});

test("a click writes exactly one row with time, offer, retailer, market and network only", async () => {
  const { call, clicks } = await setup({ now: () => Date.parse("2026-10-05T12:00:00Z") });
  await call(goPath("used:ebay:v1|123|0"), { headers: { "user-agent": "Test/1.0", "x-forwarded-for": "203.0.113.9", "cf-connecting-ip": "203.0.113.9" } });
  assert.deepEqual(await clicks(), [{ ts: "2026-10-05T12:00:00.000Z", offerId: "used:ebay:v1|123|0", retailer: "eBay Canada", market: "CA", network: null, kind: "used", model: null }]);
  await call(goPath("used:ebay:v1|123|0"), { method: "HEAD" });
  assert.equal((await clicks()).length, 1, "HEAD requests are not clicks");
});

test("the market comes from the deployment and defaults to Canada", async () => {
  assert.equal(marketFrom(undefined), "CA");
  assert.equal(marketFrom("US"), "US");
  assert.equal(marketFrom("us"), "CA");
  assert.equal(marketFrom("CA; DROP"), "CA");
  const { call, clicks } = await setup({ market: "US" });
  await call(goPath("Amazon.ca:B0TEST"));
  assert.equal((await clicks())[0].market, "US");
});

test("clicks older than 90 days are dropped and the log stops at its size cap", async () => {
  let clock = Date.parse("2026-10-05T12:00:00Z");
  const { call, clicks, clickLogPath, folder } = await setup({ now: () => clock, maxBytes: 400 });
  await writeFile(clickLogPath, `${JSON.stringify({ ts: "2026-06-01T00:00:00.000Z", offerId: "old", retailer: "Old", market: "CA" })}\n`);
  await call(goPath("Amazon.ca:B0TEST"));
  assert.deepEqual((await clicks()).map((click) => click.offerId), ["Amazon.ca:B0TEST"]);
  for (let index = 0; index < 10; index += 1) await call(goPath("Amazon.ca:B0TEST"));
  const capped = (await readFile(clickLogPath, "utf8")).length;
  assert.ok(capped < 400 + 120, `log grew to ${capped} bytes`);
  clock += 24 * 60 * 60 * 1000;
  assert.equal((await call(goPath("Amazon.ca:B0TEST"))).status, 302, "a full log still redirects");
  assert.deepEqual((await readdir(folder)).sort(), ["clicks.jsonl"]);
});

test("offer IDs are read from the path only", () => {
  assert.equal(offerIdFromPath(goPath("Brown's Sports:123")), "Brown's Sports:123");
  assert.equal(offerIdFromPath("/go/a?b=c"), null);
  assert.equal(offerIdFromPath("/go/a/b"), null);
  assert.equal(offerIdFromPath("/gone/a"), null);
});

test("every retailer link in the UI goes through /go/ and is marked sponsored", async () => {
  const uiDirectory = new URL("../app/ui/", import.meta.url);
  const files = (await readdir(uiDirectory)).filter((file) => /\.tsx?$/.test(file));
  const ui = (await Promise.all(files.map((file) => readFile(new URL(file, uiDirectory), "utf8")))).join("\n");
  assert.doesNotMatch(ui, /href=\{[\w.]*(?:offer|Offer)\.url\}/i, "an offer link still points at the retailer directly");
  assert.doesNotMatch(ui, /url: (?:best|group\.bestOffer)\.url/, "a Baseline Coach pick still points at the retailer directly");
  const outboundLinks = ui.match(/href=\{outboundHref\([^)]*\)\}[^>]*/g) ?? [];
  assert.ok(outboundLinks.length >= 11, `expected the offer links to use outboundHref, found ${outboundLinks.length}`);
  for (const link of outboundLinks) assert.match(link, /rel=\{outboundRel\}/, link);
  assert.match(ui, /outboundRel = "sponsored nofollow noreferrer"/);
});

test("the relay serves /go/ itself and robots.txt keeps crawlers out of it", async () => {
  const relay = await readFile(new URL("../scripts/baseline-relay.mjs", import.meta.url), "utf8");
  assert.match(relay, /startsWith\("\/go\/"\)\) \{\s*handleOutbound/);
  assert.match(relay, /const state = JSON\.parse\(await readFile\(stateFile, "utf8"\)\);[^\n]*\n(?:\s*\/\/[^\n]*\n)?\s*rememberOffers\(state\);/, "offers shown on the dashboard must be remembered");
  assert.ok(relay.indexOf("handleOutbound(req, res)") < relay.lastIndexOf("forward(req, res);"), "/go/ must be handled before requests are forwarded to the UI");
  assert.match(await readFile(new URL("../public/robots.txt", import.meta.url), "utf8"), /^User-agent: \*\r?\nDisallow: \/go\/$/m);
});
