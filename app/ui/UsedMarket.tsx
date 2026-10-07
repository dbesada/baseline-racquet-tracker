"use client";

import { useMemo, useState } from "react";
import { hasAffiliateLinks } from "./affiliate-disclosure";
import { AffiliateNote } from "./AffiliateNote";
import type { Dashboard, GripSize, RacquetSpec, TargetEditor, UsedAvailability, UsedSort } from "./baseline-types";
import { accents, gripLabel, gripOptions, money, offerMoney, outboundHref, outboundRel, relativeTime, usedMarketplaces } from "./baseline-catalogue";
import type { MarketplaceHealth } from "./dashboard-insights";
import { PatternBadge, RacquetImage, RacquetName } from "./racquet-visuals";
import { SourceHealth } from "./RetailHero";

// Board filter state lives in the parent (through this hook) so the choices
// survive switching to the retail market and back.
export function useUsedBoard(data: Dashboard | null) {
  const [search, setSearch] = useState("");
  const [availability, setAvailability] = useState<UsedAvailability>("all");
  const [sort, setSort] = useState<UsedSort>("watchlist");

  const modelKeys = useMemo(() => data?.modelOrder ?? [], [data]);
  const visibleModelKeys = useMemo(() => {
    const query = search.trim().toLowerCase();
    const keys = modelKeys.filter((modelKey) => {
      const offers = (data?.usedOffers ?? []).filter((offer) => offer.modelKey === modelKey);
      if (query && !(data?.modelNames[modelKey] ?? modelKey).toLowerCase().includes(query)) return false;
      if (availability === "live" && offers.length === 0) return false;
      if (availability === "empty" && offers.length > 0) return false;
      return true;
    });
    if (sort === "name-asc") return keys.sort((a, b) => (data?.modelNames[a] ?? a).localeCompare(data?.modelNames[b] ?? b, "en-CA", { sensitivity: "base" }));
    if (sort === "listings-desc") return keys.sort((a, b) => (data?.usedOffers ?? []).filter((offer) => offer.modelKey === b).length - (data?.usedOffers ?? []).filter((offer) => offer.modelKey === a).length);
    if (sort === "price-asc") return keys.sort((a, b) => {
      const best = (key: string) => Math.min(...(data?.usedOffers ?? []).filter((offer) => offer.modelKey === key && offer.currentPrice !== null).map((offer) => offer.currentPrice as number), Number.POSITIVE_INFINITY);
      return best(a) - best(b);
    });
    return keys;
  }, [data, availability, modelKeys, search, sort]);
  // Read the clock once per mount; calling it during render gives unstable results.
  const [now] = useState(() => Date.now());
  const freshCount = useMemo(() => (data?.usedOffers ?? []).filter((offer) => now - new Date(offer.lastChecked).getTime() <= 86_400_000).length, [data, now]);
  const targetHitCount = useMemo(() => new Set((data?.usedOffers ?? []).filter((offer) => offer.currentPrice !== null && offer.currentPrice <= (data?.usedTargets[offer.modelKey] ?? Math.round((data?.targets[offer.modelKey] ?? 250) * .68))).map((offer) => offer.modelKey)).size, [data]);
  const sourceCount = useMemo(() => new Set((data?.usedOffers ?? []).map((offer) => offer.store)).size, [data]);
  // Used listings for frames that are not on the watchlist.
  const otherOffers = useMemo(() => {
    const selected = new Set(data?.modelOrder ?? []);
    return (data?.usedOffers ?? []).filter((offer) => !selected.has(offer.modelKey)).slice(0, 12);
  }, [data]);

  return { search, setSearch, availability, setAvailability, sort, setSort, modelKeys, visibleModelKeys, freshCount, targetHitCount, sourceCount, otherOffers };
}

export type UsedBoardState = ReturnType<typeof useUsedBoard>;

export function UsedMarket({ board, data, loading, checking, marketplaces, specs, targetEditor, onCheckNow, onGripSizeChange, onOpenRacquet }: {
  board: UsedBoardState;
  data: Dashboard | null;
  loading: boolean;
  checking: boolean;
  marketplaces: MarketplaceHealth[];
  specs: Record<string, RacquetSpec>;
  targetEditor: TargetEditor;
  onCheckNow: () => void;
  onGripSizeChange: (gripSize: GripSize) => void;
  onOpenRacquet: (modelKey: string) => void;
}) {
  const { modelKeys, visibleModelKeys } = board;
  return <>
    <section className="hero used-hero" id="used-top">
      <div className="hero-copy">
        <p className="eyebrow">CANADIAN PRE-OWNED RACQUET SEARCH</p>
        <h1>Find the<br /><em>second bounce.</em></h1>
        <p className="lede">Baseline checks public used listings every 3 hours and only shows results with a real price, exact model and verified {gripLabel(data?.gripSize ?? "L3")} evidence.</p>
        <div className="hero-actions">
          {data?.publicPreview ? <span className="public-refresh-note">Listings refresh automatically<br /><strong>Every 3 hours</strong></span> : <button className="check-button used-browse-button" onClick={onCheckNow} disabled={checking}><span className={checking ? "spin" : ""} aria-hidden="true">↻</span>{checking ? "Checking listings…" : "Check used listings now"}</button>}
          <span className="last-check">Last checked<br /><strong>{relativeTime(data?.lastCheck?.checkedAt)}</strong></span>
        </div>
      </div>
      <div className="court-card used-court-card" aria-label="Used-market search summary">
        <div className="court-lines"><span /><span /><span /></div>
        <div className="summary-ball">
          <strong>{data?.usedOffers.length ?? 0}</strong>
          <span>live used<br />listings</span>
        </div>
        <div className="summary-copy">
          <span>{data?.gripSize ?? "L3"} verified</span>
          <strong>{board.sourceCount} sources contributing</strong>
        </div>
      </div>
    </section>

    <section className="watchlist used-watchlist" id="used-watchlist">
      <div className="section-heading">
        <div>
          <p className="eyebrow">YOUR USED-MARKET BOARD</p>
          <h2>Six frames. Live listings in one place.</h2>
        </div>
        <div className="legend"><span className="used-dot" /> Public used listings <span className="stock-dot" /> {data?.gripSize ?? "L3"} verified</div>
      </div>
      <AffiliateNote show={hasAffiliateLinks(data)} />

      <div className="used-summary-strip" aria-label="Used market summary">
        <div><span>Live listings</span><strong>{data?.usedOffers.length ?? 0}</strong><small>exact model + grip</small></div>
        <div><span>Fresh today</span><strong>{board.freshCount}</strong><small>checked in the past 24h</small></div>
        <div><span>At your target</span><strong>{board.targetHitCount}</strong><small>watched frames</small></div>
        <div><span>Last refresh</span><strong>{relativeTime(data?.lastCheck?.checkedAt)}</strong><small>automatic every 3 hours</small></div>
      </div>

      <SourceHealth data={data} />

      <div className="used-marketplace-overview" aria-label="Marketplace collector status">
        <div className="used-marketplace-intro">
          <span className="settings-label">MARKETPLACE CONNECTIONS</span>
          <strong>What Baseline checked</strong>
          <small>Direct search stays available even when an automated connector needs attention.</small>
        </div>
        <div className="used-marketplace-statuses">
          {marketplaces.map((source) => {
            const marketplace = usedMarketplaces.find((item) => item.key === source.key);
            const state = !source.configured ? "setup" : source.online ? "live" : source.checked ? "issue" : "waiting";
            const label = !source.configured ? "Open a live search" : source.online
              ? source.offers > 0 ? `${source.offers} live ${source.offers === 1 ? "listing" : "listings"}` : "Checked · no exact matches"
              : source.checked ? "Live search still available" : "Ready to search";
            return (
              <a
                className={`used-marketplace-status ${state}`}
                href={marketplace?.buildUrl(`tennis racquet ${gripLabel(data?.gripSize ?? "L3")}`)}
                target="_blank"
                rel="noreferrer"
                key={source.key}
                title={source.error ?? undefined}
              >
                <span className="marketplace-monogram">{source.name.slice(0, 2).toUpperCase()}</span>
                <span><strong>{source.name}</strong><small>{label}</small></span>
                <i aria-hidden="true">↗</i>
              </a>
            );
          })}
        </div>
      </div>

      <div className="used-controls" aria-label="Filter used racquets">
        <div className="catalogue-control-copy">
          <span className="settings-label">NARROW THE BOARD</span>
          <strong>{visibleModelKeys.length} of {modelKeys.length} frames</strong>
        </div>
        <label>Find a frame
          <input type="search" value={board.search} onChange={(event) => board.setSearch(event.target.value)} placeholder="Blade, EZONE…" />
        </label>
        <label>Grip size
          <select value={data?.gripSize ?? "L3"} onChange={(event) => onGripSizeChange(event.target.value as GripSize)}>
            {gripOptions.map((option) => <option value={option.key} key={`used-${option.key}`}>{option.key} — {option.inches}</option>)}
          </select>
        </label>
        <label>Availability
          <select value={board.availability} onChange={(event) => board.setAvailability(event.target.value as UsedAvailability)}>
            <option value="all">All watched frames</option>
            <option value="live">Live matches only</option>
            <option value="empty">Needs a match</option>
          </select>
        </label>
        <label>Sort by
          <select value={board.sort} onChange={(event) => board.setSort(event.target.value as UsedSort)}>
            <option value="watchlist">Watchlist order</option>
            <option value="price-asc">Lowest live price</option>
            <option value="listings-desc">Most listings</option>
            <option value="name-asc">Name A–Z</option>
          </select>
        </label>
        {(board.search || board.availability !== "all" || board.sort !== "watchlist") && <button className="used-reset" onClick={() => { board.setSearch(""); board.setAvailability("all"); board.setSort("watchlist"); }}>Clear filters</button>}
      </div>

      <div className="model-grid used-model-grid">
        {visibleModelKeys.map((modelKey, index) => <UsedModelCard modelKey={modelKey} index={index} data={data} spec={specs[modelKey]} targetEditor={targetEditor} onOpenRacquet={onOpenRacquet} key={`used-${modelKey}-${index}`} />)}
      </div>
      {!loading && modelKeys.length === 0 && <p className="catalogue-empty">No used-market watchlist frames are configured yet.</p>}
      {!loading && modelKeys.length > 0 && visibleModelKeys.length === 0 && <p className="catalogue-empty">No watched frames match these filters. Clear the filters to see the full board.</p>}
      <p className="used-disclaimer">Marketplace searches are live, but seller descriptions are inconsistent. Confirm the exact generation, {gripLabel(data?.gripSize ?? "L3")} grip, cracks, bumper wear and total delivered price before paying.</p>
    </section>

    <section className="sale-section used-other-section">
      <div className="sale-heading">
        <div>
          <p className="eyebrow">THE REST OF THE USED RACK</p>
          <h2>Other used frames worth a look.</h2>
        </div>
        <span className="sale-note">Verified demo/used listings · {data?.gripSize ?? "L3"}</span>
      </div>
      <div className="sale-grid">
        {board.otherOffers.map((offer) => (
          <a className="sale-offer" href={outboundHref(offer.id)} target="_blank" rel={outboundRel} key={offer.id}>
            <span className="sale-store">{offer.store} · {offer.condition}</span>
            <strong>{offer.title}</strong>
            <span className="sale-prices"><b>{offerMoney(offer)}</b><i>{offer.gripSizes.join(", ")}{offer.currency === "USD" ? " · USD" : ""}</i></span>
            <span className="arrow" aria-hidden="true">↗</span>
          </a>
        ))}
      </div>
      {!board.otherOffers.length && <p className="empty sale-empty">No additional verified used/demo listings in the latest check.</p>}
    </section>

    <section className="how-it-works" id="buyer-checklist">
      <p className="eyebrow">USED-RACQUET CHECKLIST</p>
      <div className="steps">
        <div><span>01</span><strong>Inspect the hoop</strong><p>Ask for close photos at 10, 12 and 2 o’clock. Paint chips are normal; structural cracks are not.</p></div>
        <div><span>02</span><strong>Confirm the setup</strong><p>Verify {gripLabel(data?.gripSize ?? "L3")}, exact generation, unmodified length and whether the frame needs new grommets or strings.</p></div>
        <div><span>03</span><strong>Protect the payment</strong><p>Use marketplace checkout or meet in public. Include shipping, duties and a restring when comparing the real price.</p></div>
      </div>
    </section>
  </>;
}

function UsedModelCard({ modelKey, index, data, spec, targetEditor, onOpenRacquet }: {
  modelKey: string;
  index: number;
  data: Dashboard | null;
  spec?: RacquetSpec;
  targetEditor: TargetEditor;
  onOpenRacquet: (modelKey: string) => void;
}) {
  const modelName = data?.modelNames[modelKey] ?? modelKey;
  const target = data?.usedTargets[modelKey] ?? Math.round((data?.targets[modelKey] ?? 250) * 0.68);
  const query = `${modelName} tennis racquet ${gripLabel(data?.gripSize ?? "L3")}`;
  const modelUsedOffers = (data?.usedOffers ?? []).filter((offer) => offer.modelKey === modelKey);
  const bestUsedOffer = modelUsedOffers[0];
  const editingKey = `used:${modelKey}`;
  return (
    <article className={`model-card used-model-card ${accents[modelKey] ?? "blue"}`} style={{ "--delay": `${index * 70}ms` } as React.CSSProperties}>
      <div className="card-top">
        <span className="model-number">0{index + 1}</span>
        <span className={`deal-pill used-pill ${modelUsedOffers.length ? "has-live" : ""}`}>{modelUsedOffers.length ? `${modelUsedOffers.length} live` : "Searching"}</span>
      </div>
      <div className="model-identity">
        <div><h3><RacquetName modelKey={modelKey} name={modelName} onOpen={onOpenRacquet} /></h3>{spec && <span className="card-specs">{[spec.head, spec.weight, spec.stiffness].filter(Boolean).join(" · ")}</span>}<PatternBadge pattern={spec?.pattern} /></div>
        <RacquetImage modelKey={modelKey} spec={spec} className="model-thumbnail" width={122} height={158} alt={`${modelName} racquet`} sizes="122px" onPreview={onOpenRacquet} action="details" />
      </div>
      <div className="used-card-metrics">
        <div className="used-target-metric">
          <span>Aim to pay under</span>
          {targetEditor.editingKey === editingKey ? (
            <form onSubmit={(event) => { event.preventDefault(); targetEditor.save(modelKey, "used"); }}>
              <label><span>$</span><input autoFocus inputMode="decimal" value={targetEditor.draft} onChange={(event) => targetEditor.setDraft(event.target.value)} aria-label="Used target price in Canadian dollars" /></label>
              <button type="submit">Save</button>
            </form>
          ) : (
            <button onClick={() => targetEditor.start(editingKey, target)}>
              <strong>{money.format(target)}</strong><small>Edit target</small>
            </button>
          )}
        </div>
        <div className={`used-best-metric ${bestUsedOffer ? "has-listing" : ""}`}>
          <span>Best live listing</span>
          {bestUsedOffer ? <><strong>{offerMoney(bestUsedOffer)}</strong><small>{bestUsedOffer.store}{bestUsedOffer.currentPrice !== null && bestUsedOffer.currentPrice <= target ? " · target hit" : ""}</small></> : <><strong>—</strong><small>No exact match</small></>}
        </div>
      </div>
      <div className="used-listings-head">
        <span>Verified live listings</span>
        <b>{modelUsedOffers.length}</b>
      </div>
      <div className="used-listing-stack">
        {!modelUsedOffers.length && <p className="empty used-empty">No exact {data?.gripSize ?? "L3"} match in the latest check. Try the live marketplace searches below.</p>}
        {modelUsedOffers.slice(0, 5).map((offer, offerIndex) => (
          <a href={outboundHref(offer.id)} target="_blank" rel={outboundRel} className="used-listing-row" key={offer.id}>
            <span className="used-listing-rank">{offerIndex + 1}</span>
            <span className="used-listing-copy">
              <strong>{offer.title}</strong>
              <small>{offer.store} · {offer.condition ?? "Used"} · {offer.gripSizes.join(", ")}{offer.currency === "USD" ? " · USD" : ""} · {relativeTime(offer.lastChecked)}</small>
            </span>
            <span className="used-listing-price">{offerMoney(offer)}</span>
            <span className="arrow" aria-hidden="true">→</span>
          </a>
        ))}
      </div>
      <div className="used-search-more">
        <span>Search this frame everywhere</span>
        <div className="used-market-links">
          {usedMarketplaces.map((marketplace) => (
            <a href={marketplace.buildUrl(query)} target="_blank" rel="noreferrer" key={`${modelKey}-${marketplace.key}`} title={marketplace.note}>
              <span>{marketplace.name === "Facebook Marketplace" ? "Facebook" : marketplace.name.replace(" Canada", "")}</span>
              <i aria-hidden="true">↗</i>
            </a>
          ))}
        </div>
      </div>
    </article>
  );
}
