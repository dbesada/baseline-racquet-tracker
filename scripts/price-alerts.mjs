import { createHash } from "node:crypto";
import { chmod, readFile, rename, writeFile } from "node:fs/promises";
import webpush from "web-push";
import { validSubscription } from "./push-subscription.mjs";

export { validSubscription };

// Price alerts by browser notification (Web Push). A visitor's browser gives
// us a push address (an "endpoint" at Google, Mozilla, Apple or Microsoft) and
// two encryption keys; we keep those with the racquets the visitor chose and,
// after each price check, send a notification when a racquet reaches the
// visitor's target or drops in price. No name, email, IP address or user
// agent is stored. An alert is deleted when the visitor turns it off, and a
// subscription when the browser's push service says it no longer exists.

export function subscriptionId(endpoint) {
  return createHash("sha256").update(endpoint).digest("hex").slice(0, 32);
}

const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

// Lowest in-stock price and its store for every racquet in the monitor state.
// A price from this check wins over a stale one (a store that failed this
// time keeps its last verified price for a while): stale prices are used only
// for a racquet with no fresh price at all.
export function bestPrices(state) {
  const fresh = new Map();
  const stale = new Map();
  for (const offer of Object.values(state?.offers ?? {})) {
    if (!offer || offer.modelKey === "other-sale" || offer.inStock === false || !Number.isFinite(offer.price)) continue;
    const best = offer.sourceState === "stale" ? stale : fresh;
    const current = best.get(offer.modelKey);
    if (!current || offer.price < current.price) best.set(offer.modelKey, { price: offer.price, store: offer.store });
  }
  for (const [modelKey, price] of stale) if (!fresh.has(modelKey)) fresh.set(modelKey, price);
  return fresh;
}

// Only prices verified in this check, for the price history.
export function freshBestPrices(state) {
  return bestPrices({ offers: Object.fromEntries(Object.entries(state?.offers ?? {}).filter(([, offer]) => offer?.sourceState !== "stale")) });
}

export function createPriceAlerts({ storePath, keysPath, subject = "https://baseline-beta.besada.net", send, maxSubscriptions = 5000, maxAlerts = 20, now = Date.now, warn = console.warn }) {
  let keys = null;
  let writing = Promise.resolve();

  async function vapidKeys() {
    if (keys) return keys;
    try {
      keys = JSON.parse(await readFile(keysPath, "utf8"));
    } catch {
      // First run: create the server's own signing keys and keep them private.
      keys = webpush.generateVAPIDKeys();
      await writeFile(keysPath, JSON.stringify(keys), { mode: 0o600 });
      await chmod(keysPath, 0o600).catch(() => {});
    }
    return keys;
  }

  async function readStore() {
    try {
      const parsed = JSON.parse(await readFile(storePath, "utf8"));
      return parsed?.subscriptions ? parsed : { version: 1, subscriptions: {} };
    } catch {
      return { version: 1, subscriptions: {} };
    }
  }

  // Changes are applied one at a time and written atomically.
  function update(change) {
    const result = writing.then(async () => {
      const store = await readStore();
      const outcome = await change(store);
      const temporary = `${storePath}.tmp`;
      await writeFile(temporary, JSON.stringify(store), { mode: 0o600 });
      await rename(temporary, storePath);
      return outcome;
    });
    writing = result.catch(() => {});
    return result;
  }

  async function sendTo(subscription, payload) {
    const { publicKey, privateKey } = await vapidKeys();
    const deliver = send ?? ((target, body, options) => webpush.sendNotification(target, body, options));
    return deliver(subscription, JSON.stringify(payload), { vapidDetails: { subject, publicKey, privateKey }, TTL: 6 * 60 * 60 });
  }

  return {
    async publicKey() {
      return (await vapidKeys()).publicKey;
    },

    // Adds or changes one racquet's alert. `currentPrice` starts the "any
    // drop" comparison, so the first notification is a real drop.
    async setAlert({ subscription, modelKey, mode, target, currentPrice }) {
      const valid = validSubscription(subscription);
      if (!valid) return { error: "This browser's notification address was not accepted." };
      if (mode !== "target" && mode !== "drop") return { error: "Choose target price or any drop." };
      if (mode === "target" && !(Number.isFinite(target) && target > 0 && target < 10000)) return { error: "Enter a target price." };
      return update((store) => {
        const id = subscriptionId(valid.endpoint);
        const existing = store.subscriptions[id];
        if (!existing && Object.keys(store.subscriptions).length >= maxSubscriptions) return { error: "Alerts are full right now. Please try again later." };
        const entry = existing ?? { subscription: valid, createdAt: new Date(now()).toISOString(), alerts: {} };
        entry.subscription = valid;
        if (!entry.alerts[modelKey] && Object.keys(entry.alerts).length >= maxAlerts) return { error: `You can follow up to ${maxAlerts} racquets.` };
        entry.alerts[modelKey] = {
          mode,
          ...(mode === "target" ? { target: Math.round(target * 100) / 100 } : {}),
          lastPrice: Number.isFinite(currentPrice) ? currentPrice : null,
          // A target already met counts as met, so the visitor hears about the next time it is reached.
          met: mode === "target" && Number.isFinite(currentPrice) && currentPrice <= target,
          setAt: new Date(now()).toISOString(),
        };
        store.subscriptions[id] = entry;
        return { ok: true, alerts: summary(entry) };
      });
    },

    async removeAlert({ subscription, modelKey }) {
      const valid = validSubscription(subscription);
      if (!valid) return { error: "This browser's notification address was not accepted." };
      return update((store) => {
        const id = subscriptionId(valid.endpoint);
        const entry = store.subscriptions[id];
        if (!entry) return { ok: true, alerts: {} };
        if (modelKey) delete entry.alerts[modelKey];
        if (!modelKey || !Object.keys(entry.alerts).length) delete store.subscriptions[id];
        return { ok: true, alerts: modelKey && store.subscriptions[id] ? summary(entry) : {} };
      });
    },

    async listAlerts({ subscription }) {
      const valid = validSubscription(subscription);
      if (!valid) return { alerts: {} };
      const entry = (await readStore()).subscriptions[subscriptionId(valid.endpoint)];
      return { alerts: entry ? summary(entry) : {} };
    },

    // Called after each price check with the monitor state. Returns how many
    // notifications were sent.
    async notifyAfterCheck(state, modelNames = {}) {
      const prices = bestPrices(state);
      let sent = 0;
      await update(async (store) => {
        for (const [id, entry] of Object.entries(store.subscriptions)) {
          for (const [modelKey, alert] of Object.entries(entry.alerts)) {
            const best = prices.get(modelKey);
            if (!best) continue;
            const name = modelNames[modelKey] ?? modelKey;
            let message = null;
            if (alert.mode === "target") {
              const met = best.price <= alert.target;
              if (met && !alert.met) message = `${name} is ${money.format(best.price)} at ${best.store}, at or under your ${money.format(alert.target)} target.`;
              alert.met = met;
            } else if (Number.isFinite(alert.lastPrice) && best.price < alert.lastPrice - 0.005) {
              message = `${name} dropped from ${money.format(alert.lastPrice)} to ${money.format(best.price)} at ${best.store}.`;
            }
            alert.lastPrice = best.price;
            if (!message) continue;
            try {
              await sendTo(entry.subscription, { title: "Baseline price alert", body: message, url: `/#racquet-${modelKey}`, tag: `baseline-${modelKey}` });
              alert.notifiedAt = new Date(now()).toISOString();
              sent += 1;
            } catch (error) {
              // The browser's push service no longer knows this address.
              if (error?.statusCode === 404 || error?.statusCode === 410) { delete store.subscriptions[id]; break; }
              warn(`Price alert could not be sent (${error?.statusCode ?? error?.message ?? "unknown error"})`);
            }
          }
        }
      });
      return sent;
    },
  };
}

function summary(entry) {
  return Object.fromEntries(Object.entries(entry.alerts).map(([modelKey, alert]) => [modelKey, alert.mode === "target" ? { mode: "target", target: alert.target } : { mode: "drop" }]));
}
