import { historyPath } from "../app/lib/price-history.js";

// Server-rendered racquet pages for search engines and sharing:
// /tennis-racquets/<slug> for each racquet, /tennis-racquets/ for the list, and the
// sitemap. Built by the GitHub price check (scripts/publish-cloudflare.mjs)
// and served by the Cloudflare Worker from D1/KV. Plain HTML with no
// JavaScript; "Open in Baseline" leads to the full app.

const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]);
}

// JSON for a <script type="application/ld+json"> block: "<" cannot end it early.
function jsonLd(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

function torontoTime(iso) {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(time);
}

function shortDay(day) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", month: "short", day: "numeric" }).format(Date.parse(`${day}T12:00:00Z`));
}

const styles = `
:root{--ink:#10251d;--paper:#f4f1e8;--card:#fbfaf5;--muted:#5b6b64;--line:rgba(16,37,29,.14);--lime:#dff05a;--forest:#184a36;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--ink:#f5f7f8;--paper:#10171b;--card:#172329;--muted:#c3cdd2;--line:rgba(245,247,248,.2);--forest:#9ce6bb}}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:inherit}main{max-width:960px;margin:0 auto;padding:20px 16px 56px}
.top{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line)}
.top a{font-weight:900;letter-spacing:.14em;text-decoration:none}.top nav a{font-weight:700;letter-spacing:0;margin-left:14px;font-size:.9rem}
.crumbs{font-size:.82rem;color:var(--muted);margin:6px 0 18px}.crumbs a{color:var(--muted)}
.hero{display:grid;grid-template-columns:minmax(0,1fr) 220px;gap:24px;align-items:start}
.hero img{width:100%;height:280px;object-fit:contain;background:#fff;border-radius:18px;border:1px solid var(--line)}
.brand{font-size:.78rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--forest)}
h1{margin:4px 0 8px;font-size:clamp(1.8rem,5vw,2.6rem);line-height:1.1;letter-spacing:-.03em}
.fit{color:var(--muted);margin:0 0 14px}.fit b{color:var(--ink)}
.price{font-size:2.4rem;font-weight:900;letter-spacing:-.04em;line-height:1}.price small{display:block;font-size:.9rem;font-weight:600;letter-spacing:0;color:var(--muted);margin-top:6px}
.badge{display:inline-block;margin:12px 8px 0 0;padding:5px 11px;border-radius:999px;font-size:.8rem;font-weight:800;background:color-mix(in srgb,var(--lime) 55%,transparent);color:var(--ink)}
.badge.warn{background:color-mix(in srgb,#f0a58f 45%,transparent)}
.button{display:inline-block;margin-top:16px;padding:11px 18px;border-radius:999px;background:var(--ink);color:var(--paper);font-weight:800;text-decoration:none}
section{margin-top:34px}h2{font-size:1.25rem;margin:0 0 12px}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:6px 16px}
table{width:100%;border-collapse:collapse}td,th{padding:11px 4px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}tr:last-child td{border-bottom:0}
th{font-weight:700;color:var(--muted);width:42%}.stores td:last-child{text-align:right;white-space:nowrap}
.stores a{font-weight:800}.note{color:var(--muted);font-size:.85rem}
svg{width:100%;height:auto;display:block}.chart{padding:14px 16px}.axis{display:flex;justify-content:space-between;font-size:.78rem;color:var(--muted)}
.related{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px;list-style:none;padding:0;margin:0}
.related a{display:block;padding:12px 14px;border:1px solid var(--line);border-radius:12px;text-decoration:none;background:var(--card)}.related span{display:block;color:var(--muted);font-size:.85rem}
footer{margin-top:44px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:.85rem}
@media (max-width:640px){.hero{grid-template-columns:1fr}.hero img{height:220px}.top nav a:first-child{display:none}}
`;

function shell({ title, description, canonical, image, body, structuredData }) {
  return `<!doctype html><html lang="en-CA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${escapeHtml(canonical)}">
<meta property="og:type" content="product"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:image" content="${escapeHtml(image)}"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/app-icon.svg" type="image/svg+xml"><meta name="theme-color" content="#10251d">
${structuredData.map((data) => `<script type="application/ld+json">${jsonLd(data)}</script>`).join("")}
<style>${styles}</style></head><body><header class="top"><a href="/">BASELINE</a><nav><a href="/tennis-racquets/">All racquets</a><a href="/">Open Baseline</a></nav></header><main>${body}</main></body></html>`;
}

function historyChart(history, summary) {
  const path = historyPath(history, 600, 150);
  if (!path) return `<p class="note">Baseline started recording this racquet's daily lowest price recently. A price chart appears once there are a few days of history.</p>`;
  const sorted = [...history].sort((a, b) => a.day.localeCompare(b.day));
  const lows = sorted.map((point) => point.low);
  return `<div class="card chart"><svg viewBox="0 0 600 150" role="img" aria-label="Lowest Canadian price per day"><path d="${path}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></svg>
<div class="axis"><span>${escapeHtml(shortDay(sorted[0].day))}</span><span>Low ${escapeHtml(money.format(Math.min(...lows)))} · High ${escapeHtml(money.format(Math.max(...lows)))}</span><span>${escapeHtml(shortDay(sorted.at(-1).day))}</span></div></div>
${summary ? `<p class="note">Lowest ${summary.coversMonth ? "in the last 30 days" : "since tracking began"}: ${escapeHtml(money.format(summary.low30))} on ${escapeHtml(shortDay(summary.low30Day))}. Tracking since ${escapeHtml(shortDay(summary.since))}.</p>` : ""}`;
}

// page: { siteUrl, slug, modelKey, name, brand, imageUrl, imageCredit, fit,
//   specRows [{label,value}], specSource {name,url}, offers [{id,store,price,grips,preorder}],
//   gripLabel, history [{day,low}], summary, checkedAt, affiliateOn, related [{slug,name,low}] }
export function renderRacquetPage(page) {
  const canonical = `${page.siteUrl}/tennis-racquets/${page.slug}`;
  const offers = page.offers ?? [];
  const best = offers[0];
  const checked = torontoTime(page.checkedAt);
  const title = best
    ? `${page.name} price in Canada — ${offers.length} ${offers.length === 1 ? "store" : "stores"} compared | Baseline`
    : `${page.name} — specs and Canadian availability | Baseline`;
  const description = best
    ? `Lowest Canadian price for the ${page.name}: ${money.format(best.price)} at ${best.store}${checked ? ` (checked ${checked})` : ""}. Compare ${offers.length} ${offers.length === 1 ? "store" : "stores"}, specs and price history.`
    : `${page.name} specs and Canadian availability. No tracked Canadian store has it in stock right now; Baseline checks again every 3 hours.`;

  const product = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: page.name,
    ...(page.brand ? { brand: { "@type": "Brand", name: page.brand } } : {}),
    ...(page.imageUrl ? { image: [page.imageUrl] } : {}),
    ...(page.mpn ? { mpn: page.mpn } : {}),
    description,
    url: canonical,
    ...(best ? {
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "CAD",
        lowPrice: best.price.toFixed(2),
        highPrice: Math.max(...offers.map((offer) => offer.price)).toFixed(2),
        offerCount: offers.length,
        availability: "https://schema.org/InStock",
      },
    } : {}),
  };
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Baseline", item: `${page.siteUrl}/` },
      { "@type": "ListItem", position: 2, name: "Racquets", item: `${page.siteUrl}/tennis-racquets/` },
      { "@type": "ListItem", position: 3, name: page.name, item: canonical },
    ],
  };

  const badges = [
    page.summary?.isLowest30 ? `<span class="badge">Lowest price in 30 days</span>` : "",
    page.summary?.isLowestSinceStart ? `<span class="badge">Lowest price since ${escapeHtml(shortDay(page.summary.since))}</span>` : "",
    page.summary?.aboveUsual ? `<span class="badge warn">Higher than usual (typically ${escapeHtml(money.format(page.summary.median30))})</span>` : "",
  ].join("");

  const storeRows = offers.map((offer) => `<tr><td><a href="/go/${encodeURIComponent(offer.id)}" rel="sponsored nofollow noreferrer" target="_blank">${escapeHtml(offer.store)}</a>${offer.preorder ? ` <span class="note">pre-order</span>` : ""}${offer.stale ? ` <span class="note">last verified earlier</span>` : ""}${offer.grips ? `<br><span class="note">${offer.grips} grip ${offer.grips === 1 ? "size" : "sizes"}</span>` : ""}</td><td>${escapeHtml(money.format(offer.price))}</td></tr>`).join("");

  const body = `<p class="crumbs"><a href="/">Baseline</a> › <a href="/tennis-racquets/">Racquets</a> › ${escapeHtml(page.name)}</p>
<div class="hero"><div>
${page.brand ? `<div class="brand">${escapeHtml(page.brand)}</div>` : ""}<h1>${escapeHtml(page.name)}</h1>
${page.fit ? `<p class="fit"><b>${escapeHtml(page.fit.label)}</b> · ${escapeHtml(page.fit.reasons.join(", "))}</p>` : ""}
${best ? `<div class="price">${escapeHtml(money.format(best.price))}<small>lowest at ${escapeHtml(best.store)}${checked ? ` · checked ${escapeHtml(checked)}` : ""}</small></div>${badges}` : `<p>No tracked Canadian store has this racquet in stock right now. Baseline checks again every 3 hours.</p>`}
<br><a class="button" href="/#racquet-${encodeURIComponent(page.modelKey)}">Open in Baseline · set a price alert</a>
</div>${page.imageUrl ? `<img src="${escapeHtml(page.imageUrl)}" alt="${escapeHtml(page.name)}" width="220" height="280" loading="eager">` : ""}</div>

<section><h2>Prices at Canadian stores</h2>
${offers.length ? `<div class="card"><table class="stores"><tbody>${storeRows}</tbody></table></div>
<p class="note">Prices in Canadian dollars for ${escapeHtml(page.gripLabel)} grip, lowest first. Other grip sizes may be priced differently. Shipping and tax are confirmed at the store.${page.affiliateOn ? ` Some store links may be affiliate links; that never changes the order. <a href="/affiliate-disclosure">Affiliate disclosure</a>.` : ""}</p>` : `<p class="note">None of the stores Baseline tracks lists it in stock today.</p>`}
</section>

<section><h2>Price history</h2>${historyChart(page.history ?? [], page.summary)}</section>

${page.specRows?.length ? `<section><h2>Specifications</h2><div class="card"><table><tbody>${page.specRows.map((row) => `<tr><th scope="row">${escapeHtml(row.label)}</th><td>${escapeHtml(row.value)}</td></tr>`).join("")}</tbody></table></div>
${page.specSource?.name ? `<p class="note">Source: ${page.specSource.url ? `<a href="${escapeHtml(page.specSource.url)}" rel="nofollow noreferrer">${escapeHtml(page.specSource.name)}</a>` : escapeHtml(page.specSource.name)}. Strung weight, balance and swingweight vary by setup.</p>` : ""}</section>` : ""}

${page.related?.length ? `<section><h2>More ${escapeHtml(page.brand ?? "")} racquets</h2><ul class="related">${page.related.map((item) => `<li><a href="/tennis-racquets/${encodeURIComponent(item.slug)}">${escapeHtml(item.name)}<span>${item.low ? `from ${escapeHtml(money.format(item.low))}` : "not in stock now"}</span></a></li>`).join("")}</ul></section>` : ""}

<footer>Baseline compares Canadian tennis racquet prices every 3 hours. Prices can change between checks. <a href="/privacy">Privacy</a>${page.affiliateOn ? ` · <a href="/affiliate-disclosure">Affiliate disclosure</a>` : ""}</footer>`;

  // Google requires offers (or reviews) on a Product, so racquets nobody
  // stocks get only the breadcrumb data.
  return shell({ title, description, canonical, image: page.imageUrl ?? `${page.siteUrl}/og.png`, body, structuredData: best ? [product, breadcrumbs] : [breadcrumbs] });
}

// models: [{ slug, name, brand, low, stores }] — the /tennis-racquets/ list, by brand.
export function renderRacquetIndex(models, { siteUrl, checkedAt }) {
  const byBrand = new Map();
  for (const model of [...models].sort((a, b) => a.name.localeCompare(b.name, "en-CA"))) {
    const brand = model.brand ?? "Other";
    if (!byBrand.has(brand)) byBrand.set(brand, []);
    byBrand.get(brand).push(model);
  }
  const checked = torontoTime(checkedAt);
  const body = `<p class="crumbs"><a href="/">Baseline</a> › Racquets</p><h1>Tennis racquet prices in Canada</h1>
<p class="fit">Every racquet Baseline tracks, with the lowest in-stock price at Canadian stores${checked ? ` (checked ${escapeHtml(checked)})` : ""}.</p>
${[...byBrand.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([brand, items]) => `<section><h2>${escapeHtml(brand)}</h2><ul class="related">${items.map((item) => `<li><a href="/tennis-racquets/${encodeURIComponent(item.slug)}">${escapeHtml(item.name)}<span>${item.low ? `from ${escapeHtml(money.format(item.low))} · ${item.stores} ${item.stores === 1 ? "store" : "stores"}` : "not in stock now"}</span></a></li>`).join("")}</ul></section>`).join("")}
<footer>Prices in Canadian dollars, checked every 3 hours. <a href="/privacy">Privacy</a></footer>`;
  return shell({
    title: "Tennis racquet prices in Canada — every racquet compared | Baseline",
    description: `Compare Canadian prices for ${models.length} tennis racquets across Canadian stores, updated every 3 hours.`,
    canonical: `${siteUrl}/tennis-racquets/`,
    image: `${siteUrl}/og.png`,
    body,
    structuredData: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "Tennis racquet prices in Canada", url: `${siteUrl}/tennis-racquets/` }],
  });
}

// urls: [{ path, lastmod (YYYY-MM-DD) }]
export function renderSitemap(urls, siteUrl) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `<url><loc>${escapeHtml(`${siteUrl}${url.path}`)}</loc>${url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : ""}</url>`).join("\n")}\n</urlset>\n`;
}
