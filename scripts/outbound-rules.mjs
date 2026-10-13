// Rules for outbound "buy" links (/go/<offer id>) with no Node imports, shared
// by the NAS relay (outbound-redirect.mjs), the Cloudflare Worker and the
// GitHub price check.

export const offerLists = ["specialOffers", "usedOffers", "stringOffers", "accessoryOffers", "ballOffers"];
// Which part of the site a listing belongs to, for the admin click report.
export const listKinds = { specialOffers: "special", usedOffers: "used", stringOffers: "string", accessoryOffers: "accessory", ballOffers: "ball" };

// Crawlers, link previews and scripts follow buy links too. They still get
// redirected, but are not counted as visitor clicks. The user agent is only
// looked at here and is never stored.
export function looksAutomated(userAgent) {
  return !userAgent || /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|curl|wget|python|httpclient|node-fetch|axios|headless|lighthouse|monitor/i.test(userAgent);
}

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

export function clickDetails(offer, kind) {
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

export const notFoundPage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Deal not found · Baseline</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem"><h1>This deal is no longer listed.</h1><p>The retailer may have sold out or changed the listing since this page loaded.</p><p><a href="/">Back to Baseline</a></p></body></html>`;
