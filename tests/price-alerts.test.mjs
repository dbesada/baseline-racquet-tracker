import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { bestPrices, createPriceAlerts, validSubscription } from "../scripts/price-alerts.mjs";

const subscription = { endpoint: "https://fcm.googleapis.com/fcm/send/abc123", keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" } };
const state = (prices) => ({ offers: Object.fromEntries(prices.map(([modelKey, price, store = "ATR Sports"], index) => [String(index), { id: String(index), modelKey, price, store, inStock: true }])) });

async function setup(options = {}) {
  const folder = await mkdtemp(join(tmpdir(), "baseline-alerts-"));
  const sent = [];
  const alerts = createPriceAlerts({
    storePath: join(folder, "alerts.json"),
    keysPath: join(folder, "keys.json"),
    send: async (target, payload) => {
      if (options.fail) throw Object.assign(new Error("gone"), { statusCode: options.fail });
      sent.push({ endpoint: target.endpoint, ...JSON.parse(payload) });
    },
    warn: () => {},
    ...options,
  });
  return { alerts, sent, folder };
}

test("only browser push services are accepted", () => {
  assert.ok(validSubscription(subscription));
  for (const endpoint of ["https://updates.push.services.mozilla.com/wpush/v2/x", "https://web.push.apple.com/abc", "https://wns2-par02p.notify.windows.com/w/?token=x"]) {
    assert.ok(validSubscription({ ...subscription, endpoint }), endpoint);
  }
  for (const endpoint of ["http://fcm.googleapis.com/x", "https://evil.example/fcm.googleapis.com", "https://fcm.googleapis.com.evil.example/x", "https://192.168.50.230/x", "not a url"]) {
    assert.equal(validSubscription({ ...subscription, endpoint }), null, endpoint);
  }
  assert.equal(validSubscription({ endpoint: subscription.endpoint, keys: { p256dh: "<script>", auth: "x" } }), null);
});

test("a target alert notifies once when the price reaches the target, and again only after it went back up", async () => {
  const { alerts, sent } = await setup();
  assert.deepEqual((await alerts.setAlert({ subscription, modelKey: "blade-v9", mode: "target", target: 250, currentPrice: 280 })).alerts, { "blade-v9": { mode: "target", target: 250 } });
  await alerts.notifyAfterCheck(state([["blade-v9", 270]]), { "blade-v9": "Wilson Blade 98 v9" });
  assert.equal(sent.length, 0);
  await alerts.notifyAfterCheck(state([["blade-v9", 249.99, "Tennis Giant"]]), { "blade-v9": "Wilson Blade 98 v9" });
  assert.equal(sent.length, 1);
  assert.match(sent[0].body, /Wilson Blade 98 v9 is \$249\.99 at Tennis Giant, at or under your \$250\.00 target/);
  assert.equal(sent[0].url, "/#racquet-blade-v9");
  await alerts.notifyAfterCheck(state([["blade-v9", 245]]));
  assert.equal(sent.length, 1, "not repeated while it stays under the target");
  await alerts.notifyAfterCheck(state([["blade-v9", 260]]));
  await alerts.notifyAfterCheck(state([["blade-v9", 240]]));
  assert.equal(sent.length, 2);
});

test("an any-drop alert notifies on each drop, not on rises or unchanged prices", async () => {
  const { alerts, sent } = await setup();
  await alerts.setAlert({ subscription, modelKey: "ezone-98-2025", mode: "drop", currentPrice: 349 });
  await alerts.notifyAfterCheck(state([["ezone-98-2025", 349]]));
  await alerts.notifyAfterCheck(state([["ezone-98-2025", 359]]));
  assert.equal(sent.length, 0);
  await alerts.notifyAfterCheck(state([["ezone-98-2025", 329]]));
  assert.equal(sent.length, 1);
  assert.match(sent[0].body, /dropped from \$359\.00 to \$329\.00/);
});

test("alerts can be removed, are capped, and the store and keys are private files", async () => {
  const { alerts, folder } = await setup({ maxAlerts: 2 });
  await alerts.setAlert({ subscription, modelKey: "a", mode: "drop" });
  await alerts.setAlert({ subscription, modelKey: "b", mode: "drop" });
  assert.match((await alerts.setAlert({ subscription, modelKey: "c", mode: "drop" })).error, /up to 2 racquets/);
  assert.match((await alerts.setAlert({ subscription, modelKey: "a", mode: "target", target: -5 })).error, /target price/);
  assert.deepEqual(Object.keys((await alerts.removeAlert({ subscription, modelKey: "a" })).alerts), ["b"]);
  assert.deepEqual((await alerts.listAlerts({ subscription })).alerts, { b: { mode: "drop" } });
  await alerts.removeAlert({ subscription, modelKey: "b" });
  assert.deepEqual(JSON.parse(await readFile(join(folder, "alerts.json"), "utf8")).subscriptions, {});
  assert.match(await alerts.publicKey(), /^[A-Za-z0-9_-]{80,}$/);
  if (process.platform !== "win32") assert.equal((await stat(join(folder, "keys.json"))).mode & 0o777, 0o600);
});

test("a subscription the push service no longer knows is deleted", async () => {
  const { alerts, folder } = await setup({ fail: 410 });
  await alerts.setAlert({ subscription, modelKey: "blade-v9", mode: "drop", currentPrice: 300 });
  await alerts.notifyAfterCheck(state([["blade-v9", 280]]));
  assert.deepEqual(JSON.parse(await readFile(join(folder, "alerts.json"), "utf8")).subscriptions, {});
});

test("best prices ignore sale-rack and out-of-stock offers", () => {
  const prices = bestPrices({ offers: { a: { modelKey: "x", price: 200, store: "A" }, b: { modelKey: "x", price: 150, store: "B", inStock: false }, c: { modelKey: "other-sale", price: 50 } } });
  assert.deepEqual([...prices], [["x", { price: 200, store: "A" }]]);
});

test("the relay serves the alert routes and sends alerts after each price check", async () => {
  const relay = await readFile(new URL("../scripts/baseline-relay.mjs", import.meta.url), "utf8");
  assert.match(relay, /req\.url\?\.startsWith\("\/api\/push\/"\)/);
  assert.match(relay, /priceAlerts\.notifyAfterCheck\(/);
  const worker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.match(worker, /addEventListener\("push"/);
  assert.match(worker, /data\.url\.startsWith\("\/"\)/);
  const privacy = await readFile(new URL("../app/privacy/page.tsx", import.meta.url), "utf8");
  assert.match(privacy, /If you turn on a price alert/);
});
