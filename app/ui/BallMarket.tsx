"use client";

import { useMemo, useState } from "react";
import type { BallGroup, BallOffer, BallSort, BallTypeFilter } from "./baseline-types";
import { ballFamilyKey, ballPageSize, ballTypeOrder, freshnessRank, money, relativeTime } from "./baseline-catalogue";

// Filter state lives in the parent (through this hook) so the choices survive
// switching to another tab and back.
export function useBallMarket(ballOffers: BallOffer[] | undefined) {
  const [typeFilter, setTypeFilter] = useState<BallTypeFilter>("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [packageFilter, setPackageFilter] = useState("all");
  const [sort, setSort] = useState<BallSort>("featured");
  const [visibleCount, setVisibleCount] = useState(ballPageSize);

  const allGroups = useMemo<BallGroup[]>(() => {
    const grouped = new Map<string, BallOffer[]>();
    for (const offer of ballOffers ?? []) {
      if (!offer.inStock || offer.currentPrice === null) continue;
      const key = ballFamilyKey(offer);
      grouped.set(key, [...(grouped.get(key) ?? []), offer]);
    }
    return [...grouped.entries()].map(([key, offers]) => {
      const sorted = offers.sort((a, b) => freshnessRank(a) - freshnessRank(b)
        || (a.currentPrice ?? Infinity) - (b.currentPrice ?? Infinity)
        || a.store.localeCompare(b.store, "en-CA", { sensitivity: "base" }));
      const representative = [...offers].sort((a, b) => a.title.length - b.title.length)[0];
      return { key, title: representative.title, brand: representative.brand, type: representative.type, package: representative.package, offers: sorted, bestOffer: sorted[0] };
    }).sort((a, b) => ballTypeOrder.indexOf(a.type) - ballTypeOrder.indexOf(b.type)
      || a.brand.localeCompare(b.brand, "en-CA", { sensitivity: "base" })
      || a.title.localeCompare(b.title, "en-CA", { sensitivity: "base" }));
  }, [ballOffers]);
  const availableBrands = useMemo(() => [...new Set(allGroups.map((group) => group.brand))]
    .sort((a, b) => a.localeCompare(b, "en-CA", { sensitivity: "base" })), [allGroups]);
  const availablePackages = useMemo(() => [...new Set(allGroups.map((group) => group.package))]
    .sort((a, b) => a.localeCompare(b, "en-CA", { numeric: true, sensitivity: "base" })), [allGroups]);
  const filteredGroups = useMemo(() => {
    const matches = allGroups.filter((group) => (typeFilter === "all" || group.type === typeFilter)
      && (brandFilter === "all" || group.brand === brandFilter)
      && (packageFilter === "all" || group.package === packageFilter));
    return [...matches].sort((a, b) => {
      if (sort === "price-asc") return (a.bestOffer.currentPrice ?? Infinity) - (b.bestOffer.currentPrice ?? Infinity);
      if (sort === "price-desc") return (b.bestOffer.currentPrice ?? 0) - (a.bestOffer.currentPrice ?? 0);
      if (sort === "discount") {
        const saving = (offer: BallOffer) => offer.compareAtPrice && offer.currentPrice !== null && offer.compareAtPrice > offer.currentPrice
          ? (offer.compareAtPrice - offer.currentPrice) / offer.compareAtPrice : 0;
        return saving(b.bestOffer) - saving(a.bestOffer) || (a.bestOffer.currentPrice ?? Infinity) - (b.bestOffer.currentPrice ?? Infinity);
      }
      return ballTypeOrder.indexOf(a.type) - ballTypeOrder.indexOf(b.type)
        || a.brand.localeCompare(b.brand, "en-CA", { sensitivity: "base" })
        || a.title.localeCompare(b.title, "en-CA", { sensitivity: "base" });
    });
  }, [allGroups, brandFilter, packageFilter, sort, typeFilter]);
  const visibleGroups = filteredGroups.slice(0, visibleCount);
  const stats = useMemo(() => ({
    products: filteredGroups.length,
    offers: filteredGroups.reduce((total, group) => total + group.offers.length, 0),
    retailers: new Set(filteredGroups.flatMap((group) => group.offers.map((offer) => offer.store))).size,
    types: new Set(filteredGroups.map((group) => group.type)).size,
  }), [filteredGroups]);

  return {
    typeFilter, setTypeFilter, brandFilter, setBrandFilter, packageFilter, setPackageFilter, sort, setSort, setVisibleCount,
    availableBrands, availablePackages, filteredGroups, visibleGroups, stats,
    resetPaging: () => setVisibleCount(ballPageSize),
  };
}

export type BallMarketState = ReturnType<typeof useBallMarket>;

export function BallMarket({ market, loading }: { market: BallMarketState; loading: boolean }) {
  const { stats, filteredGroups, visibleGroups, resetPaging } = market;
  return (
    <section className="accessory-market ball-market" aria-label="Tennis balls categorized by court type and package size">
      <div className="accessory-market-summary">
        <div><span>BALL PRODUCTS</span><strong>{stats.products}</strong><small>Package-matched products</small></div>
        <div><span>RETAILER OFFERS</span><strong>{stats.offers}</strong><small>Current in-stock listings</small></div>
        <div><span>RETAILERS</span><strong>{stats.retailers}</strong><small>Canadian public catalogues</small></div>
        <div><span>BALL TYPES</span><strong>{stats.types}</strong><small>Court and training categories</small></div>
      </div>
      <div className="accessory-controls" aria-label="Filter tennis balls">
        <div className="catalogue-control-copy"><span className="settings-label">FILTER TENNIS BALLS</span><strong>{filteredGroups.length} results</strong></div>
        <label><span>Type</span><select value={market.typeFilter} onChange={(event) => { market.setTypeFilter(event.target.value as BallTypeFilter); resetPaging(); }}>
          <option value="all">All ball types</option>{ballTypeOrder.map((type) => <option value={type} key={type}>{type}</option>)}
        </select></label>
        <label><span>Brand</span><select value={market.brandFilter} onChange={(event) => { market.setBrandFilter(event.target.value); resetPaging(); }}>
          <option value="all">All brands</option>{market.availableBrands.map((brand) => <option value={brand} key={brand}>{brand}</option>)}
        </select></label>
        <label><span>Package</span><select value={market.packageFilter} onChange={(event) => { market.setPackageFilter(event.target.value); resetPaging(); }}>
          <option value="all">All package sizes</option>{market.availablePackages.map((pack) => <option value={pack} key={pack}>{pack}</option>)}
        </select></label>
        <label><span>Sort</span><select value={market.sort} onChange={(event) => market.setSort(event.target.value as BallSort)}>
          <option value="featured">Type &amp; brand</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="discount">Biggest savings</option>
        </select></label>
        {(market.typeFilter !== "all" || market.brandFilter !== "all" || market.packageFilter !== "all" || market.sort !== "featured") && <button className="clear-catalogue" onClick={() => { market.setTypeFilter("all"); market.setBrandFilter("all"); market.setPackageFilter("all"); market.setSort("featured"); resetPaging(); }}>Clear</button>}
      </div>
      <div className="accessory-grid ball-grid">
        {visibleGroups.map((group) => {
          const offer = group.bestOffer;
          const discounted = offer.compareAtPrice != null && offer.compareAtPrice > (offer.currentPrice ?? 0);
          return (
            <article className={`accessory-card ball-card ${offer.sourceState === "stale" ? "stale-offer-card" : ""}`} key={group.key}>
              <div className="accessory-card-top"><span className="accessory-brand">{group.brand}</span><span className="accessory-category-pill">{group.type}</span></div>
              <div className="accessory-card-identity"><div className="accessory-mark ball-mark" aria-hidden="true"><span>●</span><i /></div><div><h4>{group.title}</h4><span className="accessory-detail">{group.package}</span></div></div>
              <div className="accessory-card-price"><span><small>{offer.sourceState === "stale" ? "LAST VERIFIED" : "BEST PRICE"}</small><strong>{money.format(offer.currentPrice ?? 0)}</strong></span><span><small>AT</small><b>{offer.store}</b></span></div>
              {discounted && <div className="accessory-saving"><del>{money.format(offer.compareAtPrice ?? 0)}</del><strong>Save {Math.round((1 - (offer.currentPrice ?? 0) / (offer.compareAtPrice ?? 1)) * 100)}%</strong></div>}
              <details className="accessory-retailers"><summary>Compare {group.offers.length} {group.offers.length === 1 ? "offer" : "offers"}</summary><div>
                {group.offers.map((retailerOffer) => <a href={retailerOffer.url} target="_blank" rel="noreferrer" key={retailerOffer.id}><span><strong>{retailerOffer.store}</strong><small>{retailerOffer.package}{retailerOffer.sourceState === "stale" ? ` · last verified ${relativeTime(retailerOffer.lastChecked)}` : ""}</small></span><b>{money.format(retailerOffer.currentPrice ?? 0)}</b><i aria-hidden="true">↗</i></a>)}
              </div></details>
            </article>
          );
        })}
      </div>
      {visibleGroups.length < filteredGroups.length && <button className="catalogue-more" onClick={() => market.setVisibleCount((count) => count + ballPageSize)}>Show more tennis balls <span>{visibleGroups.length} of {filteredGroups.length} shown</span></button>}
      {!loading && !filteredGroups.length && <div className="special-market-empty"><strong>No in-stock tennis balls match those filters.</strong><span>Try another type or package; Baseline refreshes ball catalogues every three hours.</span></div>}
    </section>
  );
}
