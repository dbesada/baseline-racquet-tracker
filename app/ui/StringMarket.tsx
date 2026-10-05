"use client";

import { useMemo, useState } from "react";
import type { StringFormatFilter, StringGroup, StringOffer, StringTypeFilter } from "./baseline-types";
import { canonicalStringBrand, freshnessRank, money, relativeTime, stringFamilyKey, stringFormatOrder, stringGaugeOrder, stringPageSize, stringTypeOrder } from "./baseline-catalogue";

// Filter state lives in the parent (through this hook) so the choices survive
// switching to another tab and back.
export function useStringMarket(stringOffers: StringOffer[] | undefined) {
  const [typeFilter, setTypeFilter] = useState<StringTypeFilter>("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [gaugeFilter, setGaugeFilter] = useState("all");
  const [formatFilter, setFormatFilter] = useState<StringFormatFilter>("all");
  const [visibleCount, setVisibleCount] = useState(stringPageSize);

  const allGroups = useMemo<StringGroup[]>(() => {
    const grouped = new Map<string, StringOffer[]>();
    for (const offer of stringOffers ?? []) {
      if (!offer.inStock || offer.currentPrice === null) continue;
      const key = stringFamilyKey(offer);
      grouped.set(key, [...(grouped.get(key) ?? []), offer]);
    }
    return [...grouped.entries()].map(([key, offers]) => {
      const sorted = offers.sort((a, b) =>
        freshnessRank(a) - freshnessRank(b)
        || (a.currentPrice ?? Infinity) - (b.currentPrice ?? Infinity)
        || a.store.localeCompare(b.store, "en-CA", { sensitivity: "base" }));
      const representative = [...offers].sort((a, b) => a.title.length - b.title.length)[0];
      const collectedGauges = [...new Set(offers.flatMap((offer) => offer.gauges))];
      const gauges = (collectedGauges.some((gauge) => gauge !== "Not listed")
        ? collectedGauges.filter((gauge) => gauge !== "Not listed") : collectedGauges)
        .sort((a, b) => stringGaugeOrder.indexOf(a) - stringGaugeOrder.indexOf(b));
      return {
        key,
        title: representative.title,
        brand: canonicalStringBrand(representative.brand, representative.title),
        type: representative.type,
        format: representative.format,
        gauges,
        offers: sorted,
        bestOffer: sorted[0],
      };
    }).sort((a, b) =>
      stringTypeOrder.indexOf(a.type) - stringTypeOrder.indexOf(b.type)
      || a.brand.localeCompare(b.brand, "en-CA", { sensitivity: "base" })
      || a.title.localeCompare(b.title, "en-CA", { sensitivity: "base" })
      || (a.bestOffer.currentPrice ?? Infinity) - (b.bestOffer.currentPrice ?? Infinity));
  }, [stringOffers]);
  const availableGauges = useMemo(() =>
    stringGaugeOrder.filter((gauge) => allGroups.some((group) => group.gauges.includes(gauge))),
  [allGroups]);
  const availableBrands = useMemo(() =>
    [...new Set(allGroups.map((group) => group.brand))]
      .sort((a, b) => a.localeCompare(b, "en-CA", { sensitivity: "base" })),
  [allGroups]);
  const availableFormats = useMemo(() =>
    stringFormatOrder.filter((format) => allGroups.some((group) => group.format === format)),
  [allGroups]);
  const filteredGroups = useMemo(() => allGroups.filter((group) =>
    (typeFilter === "all" || group.type === typeFilter)
    && (brandFilter === "all" || group.brand === brandFilter)
    && (gaugeFilter === "all" || group.gauges.includes(gaugeFilter))
    && (formatFilter === "all" || group.format === formatFilter)),
  [allGroups, brandFilter, formatFilter, gaugeFilter, typeFilter]);
  const visibleGroups = typeFilter === "all"
    ? stringTypeOrder.flatMap((type) => filteredGroups.filter((group) => group.type === type).slice(0, visibleCount))
    : filteredGroups.slice(0, visibleCount * 6);
  const groupsByType = useMemo(() => stringTypeOrder.map((type) => ({
    type,
    groups: visibleGroups.filter((group) => group.type === type),
  })).filter((section) => section.groups.length), [visibleGroups]);
  const stats = useMemo(() => ({
    products: filteredGroups.length,
    offers: filteredGroups.reduce((total, group) => total + group.offers.length, 0),
    retailers: new Set(filteredGroups.flatMap((group) => group.offers.map((offer) => offer.store))).size,
    gauges: new Set(filteredGroups.flatMap((group) => group.gauges).filter((gauge) => gauge !== "Not listed")).size,
    formats: new Set(filteredGroups.map((group) => group.format)).size,
  }), [filteredGroups]);
  // One example per string type for the string guide.
  const guideExamples = useMemo(() => stringTypeOrder.flatMap((type) => {
    const example = allGroups.find((group) => group.type === type);
    return example ? [example] : [];
  }), [allGroups]);

  return {
    typeFilter, setTypeFilter, brandFilter, setBrandFilter, gaugeFilter, setGaugeFilter, formatFilter, setFormatFilter,
    setVisibleCount, allGroups, availableGauges, availableBrands, availableFormats, filteredGroups, visibleGroups,
    groupsByType, stats, guideExamples,
    resetPaging: () => setVisibleCount(stringPageSize),
  };
}

export type StringMarketState = ReturnType<typeof useStringMarket>;

export function StringMarket({ market, loading }: { market: StringMarketState; loading: boolean }) {
  const { stats, filteredGroups, visibleGroups, resetPaging } = market;
  return (
    <section className="string-market" aria-label="Tennis strings categorized by construction type and gauge">
      <div className="string-market-summary">
        <div><span>STRING PRODUCTS</span><strong>{stats.products}</strong><small>Consolidated across retailers</small></div>
        <div><span>RETAILER OFFERS</span><strong>{stats.offers}</strong><small>Current in-stock packages</small></div>
        <div><span>RETAILERS</span><strong>{stats.retailers}</strong><small>Canadian public catalogues</small></div>
        <div><span>GAUGES</span><strong>{stats.gauges}</strong><small>Available in this view</small></div>
        <div><span>FORMATS</span><strong>{stats.formats}</strong><small>Sets, half sets, reels &amp; packages</small></div>
      </div>
      <div className="string-controls" aria-label="Filter tennis strings">
        <div className="catalogue-control-copy">
          <span className="settings-label">FILTER STRINGS</span>
          <strong>{filteredGroups.length} results</strong>
        </div>
        <label><span>Construction type</span><select value={market.typeFilter} onChange={(event) => { market.setTypeFilter(event.target.value as StringTypeFilter); resetPaging(); }}>
          <option value="all">All string types</option>
          {stringTypeOrder.map((type) => <option value={type} key={type}>{type}</option>)}
        </select></label>
        <label><span>Brand</span><select value={market.brandFilter} onChange={(event) => { market.setBrandFilter(event.target.value); resetPaging(); }}>
          <option value="all">All brands</option>
          {market.availableBrands.map((brand) => <option value={brand} key={brand}>{brand}</option>)}
        </select></label>
        <label><span>Gauge</span><select value={market.gaugeFilter} onChange={(event) => { market.setGaugeFilter(event.target.value); resetPaging(); }}>
          <option value="all">All gauges</option>
          {market.availableGauges.map((gauge) => <option value={gauge} key={gauge}>{gauge === "Not listed" ? "Gauge not listed" : `${gauge} gauge`}</option>)}
        </select></label>
        <label><span>Package format</span><select value={market.formatFilter} onChange={(event) => { market.setFormatFilter(event.target.value as StringFormatFilter); resetPaging(); }}>
          <option value="all">All formats</option>
          {market.availableFormats.map((format) => <option value={format} key={format}>{format}</option>)}
        </select></label>
        {(market.typeFilter !== "all" || market.brandFilter !== "all" || market.gaugeFilter !== "all" || market.formatFilter !== "all") && <button className="clear-catalogue" onClick={() => { market.setTypeFilter("all"); market.setBrandFilter("all"); market.setGaugeFilter("all"); market.setFormatFilter("all"); resetPaging(); }}>Clear</button>}
      </div>
      <div className="string-type-sections">
        {market.groupsByType.map((section) => (
          <section className="string-type-section" key={section.type}>
            <div className="string-type-heading">
              <div><span>STRING TYPE</span><h3>{section.type}</h3></div>
              <b>{section.groups.length} {section.groups.length === 1 ? "product" : "products"}</b>
            </div>
            <div className="string-grid">
              {section.groups.map((group) => <StringCard group={group} key={group.key} />)}
            </div>
          </section>
        ))}
      </div>
      {visibleGroups.length < filteredGroups.length && (
        <button className="catalogue-more" onClick={() => market.setVisibleCount((count) => count + stringPageSize)}>
          Show more strings <span>{visibleGroups.length} of {filteredGroups.length} shown</span>
        </button>
      )}
      {!loading && !filteredGroups.length && <div className="special-market-empty"><strong>No in-stock strings match those filters.</strong><span>Try another type or gauge; Baseline refreshes string catalogues every three hours.</span></div>}
    </section>
  );
}

function StringCard({ group }: { group: StringGroup }) {
  const offer = group.bestOffer;
  return (
    <article className={`string-card ${offer.sourceState === "stale" ? "stale-offer-card" : ""}`}>
      <div className="string-card-top">
        <span className="string-brand">{group.brand}</span>
        <span className="string-format">{group.format}</span>
      </div>
      <div className="string-card-identity">
        <div className="string-coil" aria-hidden="true"><i /><i /><i /></div>
        <h4>{group.title}</h4>
      </div>
      <div className="string-gauges" aria-label={`Available gauges: ${group.gauges.join(", ")}`}>
        {group.gauges.map((gauge) => <b key={`${group.key}-${gauge}`}>{gauge === "Not listed" ? "Gauge n/a" : gauge}</b>)}
      </div>
      <div className="string-card-price">
        <span><small>{offer.sourceState === "stale" ? "LAST VERIFIED" : "BEST PRICE"}</small><strong>{money.format(offer.currentPrice ?? 0)}</strong></span>
        <span><small>AT</small><b>{offer.store}</b></span>
      </div>
      {offer.compareAtPrice != null && offer.compareAtPrice > (offer.currentPrice ?? 0) && <div className="string-saving"><del>{money.format(offer.compareAtPrice)}</del><strong>Save {Math.round((1 - (offer.currentPrice ?? 0) / offer.compareAtPrice) * 100)}%</strong></div>}
      <details className="string-retailers">
        <summary>Compare {group.offers.length} {group.offers.length === 1 ? "offer" : "offers"}</summary>
        <div>
          {group.offers.map((retailerOffer) => (
            <a href={retailerOffer.url} target="_blank" rel="noreferrer" key={retailerOffer.id}>
              <span><strong>{retailerOffer.store}</strong><small>{retailerOffer.gauges.join(" · ")} · {retailerOffer.format}{retailerOffer.sourceState === "stale" ? ` · last verified ${relativeTime(retailerOffer.lastChecked)}` : ""}</small></span>
              <b>{money.format(retailerOffer.currentPrice ?? 0)}</b>
              <i aria-hidden="true">↗</i>
            </a>
          ))}
        </div>
      </details>
    </article>
  );
}
