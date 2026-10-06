"use client";

import { useMemo, useState } from "react";
import type { Offer, RacquetSpec, SpecialAvailabilityFilter, SpecialEditionGroup, SpecialGripFilter, SpecialSort } from "./baseline-types";
import { freshnessRank, gripOptions, money, outboundHref, outboundRel, preferredSpecialTitle, relativeTime, specialEditionFamily, specialEditionGroupLabel, specialEditionModelKey, specialEditionName, specialGripLabels, specialOfferBrand } from "./baseline-catalogue";
import { PatternBadge, RacquetImage } from "./racquet-visuals";

// Filter state lives in the parent (through this hook) so the choices survive
// switching to another tab and back.
export function useSpecialEditions(specialOffers: Offer[] | undefined, gripSize: string) {
  const [brandFilter, setBrandFilter] = useState("all");
  const [gripFilter, setGripFilter] = useState<SpecialGripFilter>("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<SpecialAvailabilityFilter>("all");
  const [sort, setSort] = useState<SpecialSort>("edition");

  const groups = useMemo<SpecialEditionGroup[]>(() => {
    const matches = (specialOffers ?? []).filter((offer) =>
      offer.inStock && offer.currentPrice !== null && specialEditionName(offer.title) && specialGripLabels(offer.gripSizes).length);
    const uniqueOffers = new Map<string, Offer>();
    for (const offer of matches) {
      const existing = uniqueOffers.get(offer.id);
      if (!existing || (offer.currentPrice ?? Infinity) < (existing.currentPrice ?? Infinity)) uniqueOffers.set(offer.id, offer);
    }
    const grouped = new Map<string, { modelKey: string; offers: Offer[] }>();
    for (const offer of uniqueOffers.values()) {
      const modelKey = specialEditionModelKey(offer);
      const key = `${modelKey}:${specialEditionFamily(offer.title)}`;
      const group = grouped.get(key) ?? { modelKey, offers: [] };
      group.offers.push(offer);
      grouped.set(key, group);
    }
    return [...grouped.entries()].map(([key, group]) => {
      const offers = group.offers.sort((a, b) =>
        freshnessRank(a) - freshnessRank(b)
        || (a.currentPrice ?? Infinity) - (b.currentPrice ?? Infinity)
        || a.store.localeCompare(b.store, "en-CA", { sensitivity: "base" }));
      const grips = [...new Set(offers.flatMap((offer) => specialGripLabels(offer.gripSizes)))].sort();
      return {
        key,
        modelKey: group.modelKey,
        edition: specialEditionGroupLabel(offers),
        title: preferredSpecialTitle(offers),
        offers,
        grips,
        bestOffer: offers[0],
      };
    }).sort((a, b) =>
      a.edition.localeCompare(b.edition, "en-CA", { sensitivity: "base" })
      || a.title.localeCompare(b.title, "en-CA", { sensitivity: "base" })
      || (a.bestOffer.currentPrice ?? Infinity) - (b.bestOffer.currentPrice ?? Infinity));
  }, [specialOffers]);
  const stats = useMemo(() => ({
    racquets: groups.length,
    offers: groups.reduce((total, group) => total + group.offers.length, 0),
    retailers: new Set(groups.flatMap((group) => group.offers.map((offer) => offer.store))).size,
    gripSizes: new Set(groups.flatMap((group) => group.grips)).size,
    selectedGrip: groups.filter((group) => group.grips.includes(gripSize)).length,
  }), [gripSize, groups]);
  const brands = useMemo(() => [...new Set(groups.map(specialOfferBrand))].sort((a, b) => a.localeCompare(b, "en-CA", { sensitivity: "base" })), [groups]);
  const filteredGroups = useMemo(() => groups.filter((group) => {
    if (brandFilter !== "all" && specialOfferBrand(group) !== brandFilter) return false;
    if (gripFilter !== "all" && gripFilter !== "multiple" && !group.grips.includes(gripFilter)) return false;
    if (gripFilter === "multiple" && group.grips.length < 2) return false;
    if (availabilityFilter === "multi" && group.offers.length < 2) return false;
    return true;
  }).sort((a, b) => {
    if (sort === "name-asc") return a.title.localeCompare(b.title, "en-CA", { sensitivity: "base" });
    if (sort === "price-asc") return (a.bestOffer.currentPrice ?? Infinity) - (b.bestOffer.currentPrice ?? Infinity);
    if (sort === "price-desc") return (b.bestOffer.currentPrice ?? -Infinity) - (a.bestOffer.currentPrice ?? -Infinity);
    if (sort === "retailers-desc") return b.offers.length - a.offers.length || a.title.localeCompare(b.title, "en-CA", { sensitivity: "base" });
    return a.edition.localeCompare(b.edition, "en-CA", { sensitivity: "base" }) || a.title.localeCompare(b.title, "en-CA", { sensitivity: "base" });
  }), [availabilityFilter, brandFilter, groups, gripFilter, sort]);

  return {
    brandFilter, setBrandFilter, gripFilter, setGripFilter, availabilityFilter, setAvailabilityFilter, sort, setSort,
    groups, stats, brands, filteredGroups,
  };
}

export type SpecialEditionState = ReturnType<typeof useSpecialEditions>;

export function SpecialEditionMarket({ market, gripSize, loading, specs, onPreviewImage }: {
  market: SpecialEditionState;
  gripSize: string;
  loading: boolean;
  specs: Record<string, RacquetSpec>;
  onPreviewImage: (modelKey: string) => void;
}) {
  const { stats, filteredGroups } = market;
  return (
    <section className="special-market" aria-label="Special-edition racquets available across all verified grip sizes">
      <div className="special-market-summary">
        <div><span>UNIQUE RACQUETS</span><strong>{stats.racquets}</strong><small>One card per special release</small></div>
        <div><span>RETAILER OFFERS</span><strong>{stats.offers}</strong><small>Consolidated under each racquet</small></div>
        <div><span>GRIP SIZES</span><strong>{stats.gripSizes}</strong><small>Verified sizes from L0 through L5</small></div>
        <div><span>{gripSize} AVAILABLE</span><strong>{stats.selectedGrip}</strong><small>Matches your required grip</small></div>
        <div><span>RETAILERS</span><strong>{stats.retailers}</strong><small>With verified stock right now</small></div>
      </div>
      <div className="special-controls" aria-label="Filter special-edition racquets">
        <div className="catalogue-control-copy"><span className="settings-label">BROWSE RELEASES</span><strong>{filteredGroups.length} of {market.groups.length}</strong></div>
        <label><span>Brand</span><select value={market.brandFilter} onChange={(event) => market.setBrandFilter(event.target.value)}><option value="all">All brands</option>{market.brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}</select></label>
        <label><span>Grip</span><select value={market.gripFilter} onChange={(event) => market.setGripFilter(event.target.value as SpecialGripFilter)}><option value="all">Any verified grip</option>{gripOptions.map((option) => <option value={option.key} key={`special-${option.key}`}>{option.key} — {option.inches}</option>)}<option value="multiple">Multiple grip sizes</option></select></label>
        <label><span>Retailer coverage</span><select value={market.availabilityFilter} onChange={(event) => market.setAvailabilityFilter(event.target.value as SpecialAvailabilityFilter)}><option value="all">Any verified stock</option><option value="multi">2+ retailers</option></select></label>
        <label><span>Sort by</span><select value={market.sort} onChange={(event) => market.setSort(event.target.value as SpecialSort)}><option value="edition">Edition, then name</option><option value="name-asc">Name: A to Z</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="retailers-desc">Most retailer choices</option></select></label>
        {(market.brandFilter !== "all" || market.gripFilter !== "all" || market.availabilityFilter !== "all" || market.sort !== "edition") && <button className="clear-catalogue" onClick={() => { market.setBrandFilter("all"); market.setGripFilter("all"); market.setAvailabilityFilter("all"); market.setSort("edition"); }}>Clear</button>}
      </div>
      <div className="special-market-grid">
        {filteredGroups.map((group) => <SpecialEditionCard group={group} spec={specs[group.modelKey]} onPreviewImage={onPreviewImage} key={`special-market-${group.key}`} />)}
      </div>
      {!loading && !filteredGroups.length && <div className="special-market-empty"><strong>No special editions match those filters.</strong><span>Clear the filters or try another grip; Baseline keeps checking all enabled retailers every 3 hours.</span></div>}
    </section>
  );
}

function SpecialEditionCard({ group, spec, onPreviewImage }: { group: SpecialEditionGroup; spec?: RacquetSpec; onPreviewImage: (modelKey: string) => void }) {
  const offer = group.bestOffer;
  return (
    <article className={`special-market-card ${offer.sourceState === "stale" ? "stale-offer-card" : ""}`}>
      <div className="special-card-top">
        <span className="special-badge">{group.edition}</span>
        <span className="sale-store">{group.offers.length} {group.offers.length === 1 ? "retailer" : "retailers"}</span>
      </div>
      <div className="special-card-body">
        <div>
          <span className="special-brand">{specialOfferBrand(group)}</span>
          <h3>{group.title}</h3>
          <PatternBadge pattern={spec?.pattern} compact />
        </div>
        <RacquetImage modelKey={group.modelKey} spec={spec} className="special-frame-thumb" width={82} height={112} alt={`${group.title} racquet`} onPreview={onPreviewImage} />
      </div>
      <div className="special-card-footer">
        <span><small className="special-price-label">{offer.sourceState === "stale" ? "LAST VERIFIED" : "BEST PRICE"}</small><span className="special-price">{money.format(offer.currentPrice ?? 0)}{offer.compareAtPrice != null && offer.compareAtPrice > (offer.currentPrice ?? 0) && <del>{money.format(offer.compareAtPrice)}</del>}</span></span>
        <span className="special-grips">{group.grips.map((grip) => <b key={`${group.key}-${grip}`}>{grip}<small>{gripOptions.find((option) => option.key === grip)?.inches.replace(" in", "") ?? "Check size"}</small></b>)}</span>
      </div>
      <details className="special-retailers">
        <summary>Compare {group.offers.length} retailer {group.offers.length === 1 ? "offer" : "offers"}</summary>
        <div className="special-retailer-list">
          {group.offers.map((retailerOffer) => (
            <a href={outboundHref(retailerOffer.id)} target="_blank" rel={outboundRel} key={`${group.key}-${retailerOffer.id}`}>
              <span><strong>{retailerOffer.store}</strong><small>{specialGripLabels(retailerOffer.gripSizes).join(" · ")}{retailerOffer.sourceState === "stale" ? ` · last verified ${relativeTime(retailerOffer.lastChecked)}` : ""}</small></span>
              <b>{money.format(retailerOffer.currentPrice ?? 0)}</b>
              <span className="arrow" aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
      </details>
    </article>
  );
}
