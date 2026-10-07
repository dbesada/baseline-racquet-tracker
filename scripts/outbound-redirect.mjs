import { appendFile, readFile, rename, stat, writeFile } from "node:fs/promises";

// Outbound "buy" links go through /go/<offer id>. The relay looks the ID up in
// the price monitor's state file and redirects to the URL stored there, so a
// visitor can never choose where they are sent (no open redirect). Each click
// is logged with the time, offer, retailer, market, affiliate network (null
// for a plain link), the kind of listing and, for racquets, the model only:
// no IP address, user agent, referrer or cookie.
//
// The market is a property of the deployment (this one is Canada), not of an
// offer, so another market runs the same code with BASELINE_MARKET set.

const offerLists = ["specialOffers", "usedOffers", "stringOffers", "accessoryOffers", "ballOffers"];
// Which part of the site a listing belongs to, for the admin click report.
const listKinds = { specialOffers: "special", usedOffers: "used", stringOffers: "string", accessoryOffers: "accessory", ballOffers: "ball" };
const dayMs = 24 * 60 * 60 * 1000;

export function marketFrom(value) {
  return /^[A-Z]{2}$/.test(value ?? "") ? value : "CA";
}

export function findOffer(state, offerId) {
  return findListedOffer(state, offerId)?.offer ?? null;
}

// The offer plus what the click report needs to know about it.
export function findListedOffer(state, offerId) {
  if (!state || typeof state !== "object" || typeof offerId !== "string" || !offerId) return null;
  const racquet = Object.values(state.offers ?? {}).find((offer) => offer?.id === offerId);
  if (racquet) return { offer: racquet, ...clickDetails(racquet, racquet.modelKey === "other-sale" ? "sale" : "racquet") };
  for (const list of offerLists) {
    const offer = Array.isArray(state[list]) ? state[list].find((candidate) => candidate?.id === offerId) : null;
    if (offer) return { offer, ...clickDetails(offer, listKinds[list]) };
  }
  return null;
}

function clickDetails(offer, kind) {
  const model = (kind === "racquet" || kind === "special" || kind === "used") && /^[a-z0-9-]{1,80}$/.test(offer.modelKey ?? "") && offer.modelKey !== "other-sale" ? offer.modelKey : null;
  return { kind, model };
}

// Only absolute http(s) URLs taken from the state file are ever redirected to.
export function offerDestination(offer) {
  try {
    const url = new URL(offer?.url);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

// Returns the decoded offer ID for "/go/<id>", or null for anything else
// (extra path segments, query strings, malformed escapes).
export function offerIdFromPath(requestUrl) {
  const match = /^\/go\/([^/?#]+)$/.exec(requestUrl ?? "");
  if (!match) return null;
  try { return decodeURIComponent(match[1]); }
  catch { return null; }
}

// The privacy page promises analytics are kept for up to 90 days, so older
// clicks are dropped once a day. The public preview can reach /go/, so the log
// also stops growing at `maxBytes` until pruning makes room.
function createClickLog({ path, maxBytes, retentionDays, now }) {
  let prunedOn = null;
  let writes = Promise.resolve();

  async function prune() {
    const cutoff = new Date(now() - retentionDays * dayMs).toISOString();
    let text;
    try { text = await readFile(path, "utf8"); } catch { return; }
    const kept = text.split("\n").filter((line) => {
      try { return JSON.parse(line).ts >= cutoff; } catch { return false; }
    });
    const temporary = `${path}.tmp`;
    await writeFile(temporary, kept.map((line) => `${line}\n`).join(""));
    await rename(temporary, path);
  }

  return function record(click) {
    writes = writes.then(async () => {
      const today = new Date(now()).toISOString().slice(0, 10);
      if (prunedOn !== today) {
        await prune();
        prunedOn = today;
      }
      const size = await stat(path).then((info) => info.size, () => 0);
      if (size >= maxBytes) return;
      await appendFile(path, `${JSON.stringify(click)}\n`);
    }).catch(() => {});
    return writes;
  };
}

const notFoundPage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Deal not found · Baseline</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem"><h1>This deal is no longer listed.</h1><p>The retailer may have sold out or changed the listing since this page loaded.</p><p><a href="/">Back to Baseline</a></p></body></html>`;

// Without affiliate settings every click goes to the plain retailer link.
const plainLinks = (offer, destination) => ({ url: destination, network: null });

export function createOutboundRedirect({ readState, clickLogPath, market = "CA", affiliate = plainLinks, maxBytes = 5_000_000, retentionDays = 90, rememberDays = 7, now = Date.now }) {
  const recordClick = createClickLog({ path: clickLogPath, maxBytes, retentionDays, now });
  // A price check rewrites the state file and drops offers that sold out, but
  // a page loaded earlier still links to them. Remember every offer the relay
  // has shown for a few days so those links keep reaching the retailer, as
  // they did when they pointed there directly. This also covers a click that
  // arrives while the monitor is part-way through writing the file.
  const remembered = new Map();

  function rememberOffers(state) {
    const seenAt = now();
    const remember = (offer, kind) => {
      if (typeof offer?.id === "string" && offerDestination(offer)) remembered.set(offer.id, { offer: { id: offer.id, store: offer.store, url: offer.url }, ...clickDetails(offer, kind), seenAt });
    };
    for (const offer of Object.values(state?.offers ?? {})) remember(offer, offer?.modelKey === "other-sale" ? "sale" : "racquet");
    for (const list of offerLists) for (const offer of Array.isArray(state?.[list]) ? state[list] : []) remember(offer, listKinds[list]);
    for (const [id, entry] of remembered) if (seenAt - entry.seenAt > rememberDays * dayMs) remembered.delete(id);
  }

  async function handleOutbound(req, res) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { allow: "GET, HEAD" });
      res.end();
      return;
    }
    const offerId = offerIdFromPath(req.url);
    let listed = null;
    if (offerId) {
      try {
        const state = await readState();
        rememberOffers(state);
        listed = findListedOffer(state, offerId);
      } catch { /* No collector run yet, or the file is being rewritten. */ }
      listed ??= remembered.get(offerId) ?? null;
    }
    const offer = listed?.offer ?? null;
    const destination = offer && offerDestination(offer);
    if (!destination) {
      res.writeHead(404, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" });
      res.end(req.method === "HEAD" ? undefined : notFoundPage);
      return;
    }
    const link = affiliate(offer, destination);
    // Logging never throws, so it cannot stop the visitor reaching the retailer.
    if (req.method === "GET") {
      await recordClick({ ts: new Date(now()).toISOString(), offerId, retailer: offer.store ?? "Unknown", market, network: link.network, kind: listed.kind ?? null, model: listed.model ?? null });
    }
    res.writeHead(302, { location: link.url, "cache-control": "no-store", "referrer-policy": "no-referrer" });
    res.end();
  }

  return { handleOutbound, rememberOffers };
}
