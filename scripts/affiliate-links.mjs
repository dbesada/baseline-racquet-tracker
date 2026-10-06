import { readFile } from "node:fs/promises";

// Per-retailer affiliate links for the /go/ redirect. Each market has its own
// file (config/affiliates/<market>.json) and a deployment reads only the file
// for its own market, so Canadian and U.S. programmes never mix.
//
// An entry either adds query parameters to the retailer's own link
// (`addParams`, e.g. a store referral code) or wraps the link in a network's
// click URL (`linkTemplate`, with `{url}` standing for the encoded retailer
// link). Anything disabled, unmatched, invalid or not https falls back to the
// plain retailer link, so a bad entry can never break a link.

const placeholder = /your[-_ ]|example|placeholder|xxx|<|>/i;

export function affiliateConfigUrl(market) {
  return new URL(`../config/affiliates/${market.toLowerCase()}.json`, import.meta.url);
}

function entryErrors(entry, market) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return ["is not an object"];
  const errors = [];
  if (typeof entry.retailer !== "string" || !entry.retailer.trim()) errors.push("needs a retailer name");
  if (entry.market !== market) errors.push(`must have market "${market}"`);
  if (typeof entry.network !== "string" || !/^[a-z0-9-]{2,40}$/.test(entry.network)) errors.push("needs a network such as \"amazon-associates\"");
  if (typeof entry.enabled !== "boolean") errors.push("needs enabled: true or false");
  if (!Array.isArray(entry.hosts) || !entry.hosts.length || !entry.hosts.every((host) => typeof host === "string" && /^[a-z0-9.-]+$/.test(host))) {
    errors.push("needs hosts, the retailer link hostnames it applies to");
  }
  const hasParams = entry.addParams !== undefined;
  const hasTemplate = entry.linkTemplate !== undefined;
  if (hasParams === hasTemplate) errors.push("needs exactly one of addParams or linkTemplate");
  if (hasParams) {
    const params = entry.addParams;
    if (!params || typeof params !== "object" || Array.isArray(params) || !Object.keys(params).length
      || !Object.entries(params).every(([key, value]) => key && typeof value === "string" && value)) {
      errors.push("addParams must map parameter names to non-empty text");
    }
  }
  if (hasTemplate) {
    const template = entry.linkTemplate;
    if (typeof template !== "string" || template.split("{url}").length !== 2) errors.push("linkTemplate must contain {url} exactly once");
    else {
      try {
        if (new URL(template.replace("{url}", "x")).protocol !== "https:") errors.push("linkTemplate must be an https link");
      } catch { errors.push("linkTemplate is not a valid link"); }
    }
  }
  if (entry.enabled === true) {
    const values = [entry.linkTemplate, ...Object.values(entry.addParams ?? {})].filter((value) => typeof value === "string");
    if (values.some((value) => placeholder.test(value))) errors.push("is enabled but still has placeholder values");
  }
  return errors;
}

// Returns the usable entries by retailer name, plus a message for every entry
// that was left out.
export function validateAffiliateConfig(config, market) {
  if (!config || typeof config !== "object" || config.market !== market || !Array.isArray(config.retailers)) {
    return { entries: new Map(), errors: [`the file must be { "market": "${market}", "retailers": [...] }`] };
  }
  const entries = new Map();
  const errors = [];
  for (const [index, entry] of config.retailers.entries()) {
    const name = typeof entry?.retailer === "string" ? entry.retailer : `entry ${index + 1}`;
    const problems = entryErrors(entry, market);
    if (!problems.length && entries.has(entry.retailer)) problems.push("is listed twice");
    if (problems.length) errors.push(`${name} ${problems.join("; ")}`);
    else entries.set(entry.retailer, entry);
  }
  return { entries, errors };
}

// The affiliate link for one retailer link, or null to use the plain link.
export function affiliateUrl(entry, destination) {
  try {
    const url = new URL(destination);
    if (!entry.hosts.includes(url.hostname)) return null;
    let result;
    if (entry.addParams) {
      for (const [key, value] of Object.entries(entry.addParams)) url.searchParams.set(key, value);
      result = url;
    } else {
      result = new URL(entry.linkTemplate.replace("{url}", encodeURIComponent(destination)));
    }
    return result.protocol === "https:" ? result.href : null;
  } catch {
    return null;
  }
}

export function createAffiliateLinks(entries) {
  return function affiliate(offer, destination) {
    const entry = entries.get(offer?.store);
    const url = entry?.enabled ? affiliateUrl(entry, destination) : null;
    return url ? { url, network: entry.network } : { url: destination, network: null };
  };
}

// Reads this market's file. A missing or invalid file means plain links only.
export async function loadAffiliateLinks({ market, url = affiliateConfigUrl(market), warn = () => {} }) {
  let config;
  try { config = JSON.parse(await readFile(url, "utf8")); }
  catch (error) {
    warn(`Affiliate links are off: could not read ${url.pathname ?? url} (${error.code ?? error.message})`);
    return createAffiliateLinks(new Map());
  }
  const { entries, errors } = validateAffiliateConfig(config, market);
  for (const error of errors) warn(`Affiliate entry skipped: ${error}`);
  return createAffiliateLinks(entries);
}
