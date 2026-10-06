"use client";

import { useMemo, useState } from "react";
import type { AccessoryCategoryFilter, AccessoryGroup, AccessoryOffer, AccessorySort } from "./baseline-types";
import { accessoryCategoryMarks, accessoryCategoryOrder, accessoryFamilyKey, accessoryPageSize, freshnessRank, money, outboundHref, outboundRel, relativeTime } from "./baseline-catalogue";

// Filter state lives in the parent (through this hook) so the choices survive
// switching to another tab and back.
export function useAccessoryMarket(accessoryOffers: AccessoryOffer[] | undefined) {
  const [categoryFilter, setCategoryFilter] = useState<AccessoryCategoryFilter>("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<AccessorySort>("featured");
  const [visibleCount, setVisibleCount] = useState(accessoryPageSize);

  const allGroups = useMemo<AccessoryGroup[]>(() => {
    const grouped = new Map<string, AccessoryOffer[]>();
    for (const offer of accessoryOffers ?? []) {
      if (!offer.inStock || offer.currentPrice === null) continue;
      const key = accessoryFamilyKey(offer);
      grouped.set(key, [...(grouped.get(key) ?? []), offer]);
    }
    return [...grouped.entries()].map(([key, offers]) => {
      const sorted = offers.sort((a, b) =>
        freshnessRank(a) - freshnessRank(b)
        || (a.currentPrice ?? Infinity) - (b.currentPrice ?? Infinity)
        || a.store.localeCompare(b.store, "en-CA", { sensitivity: "base" }));
      const representative = [...offers].sort((a, b) => a.title.length - b.title.length)[0];
      return {
        key,
        title: representative.title,
        brand: representative.brand,
        category: representative.category,
        detail: representative.detail,
        offers: sorted,
        bestOffer: sorted[0],
      };
    }).sort((a, b) =>
      accessoryCategoryOrder.indexOf(a.category) - accessoryCategoryOrder.indexOf(b.category)
      || a.brand.localeCompare(b.brand, "en-CA", { sensitivity: "base" })
      || a.title.localeCompare(b.title, "en-CA", { sensitivity: "base" })
      || (a.bestOffer.currentPrice ?? Infinity) - (b.bestOffer.currentPrice ?? Infinity));
  }, [accessoryOffers]);
  const availableBrands = useMemo(() =>
    [...new Set(allGroups.map((group) => group.brand))]
      .sort((a, b) => a.localeCompare(b, "en-CA", { sensitivity: "base" })),
  [allGroups]);
  const filteredGroups = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("en-CA");
    const matches = allGroups.filter((group) =>
      (categoryFilter === "all" || group.category === categoryFilter)
      && (brandFilter === "all" || group.brand === brandFilter)
      && (!query || `${group.brand} ${group.title} ${group.category} ${group.detail}`.toLocaleLowerCase("en-CA").includes(query)));
    return [...matches].sort((a, b) => {
      if (sort === "price-asc") return (a.bestOffer.currentPrice ?? Infinity) - (b.bestOffer.currentPrice ?? Infinity);
      if (sort === "price-desc") return (b.bestOffer.currentPrice ?? 0) - (a.bestOffer.currentPrice ?? 0);
      if (sort === "discount") {
        const saving = (offer: AccessoryOffer) => offer.compareAtPrice && offer.currentPrice !== null && offer.compareAtPrice > offer.currentPrice
          ? (offer.compareAtPrice - offer.currentPrice) / offer.compareAtPrice : 0;
        return saving(b.bestOffer) - saving(a.bestOffer) || (a.bestOffer.currentPrice ?? Infinity) - (b.bestOffer.currentPrice ?? Infinity);
      }
      return accessoryCategoryOrder.indexOf(a.category) - accessoryCategoryOrder.indexOf(b.category)
        || a.brand.localeCompare(b.brand, "en-CA", { sensitivity: "base" })
        || a.title.localeCompare(b.title, "en-CA", { sensitivity: "base" });
    });
  }, [allGroups, brandFilter, categoryFilter, search, sort]);
  const visibleGroups = categoryFilter === "all"
    ? accessoryCategoryOrder.flatMap((category) => filteredGroups.filter((group) => group.category === category).slice(0, visibleCount))
    : filteredGroups.slice(0, visibleCount);
  const groupsByCategory = useMemo(() => accessoryCategoryOrder.map((category) => ({
    category,
    groups: visibleGroups.filter((group) => group.category === category),
  })).filter((section) => section.groups.length), [visibleGroups]);
  const stats = useMemo(() => ({
    products: filteredGroups.length,
    offers: filteredGroups.reduce((total, group) => total + group.offers.length, 0),
    retailers: new Set(filteredGroups.flatMap((group) => group.offers.map((offer) => offer.store))).size,
    categories: new Set(filteredGroups.map((group) => group.category)).size,
  }), [filteredGroups]);

  return {
    categoryFilter, setCategoryFilter, brandFilter, setBrandFilter, search, setSearch, sort, setSort, setVisibleCount,
    availableBrands, filteredGroups, visibleGroups, groupsByCategory, stats,
    resetPaging: () => setVisibleCount(accessoryPageSize),
  };
}

export type AccessoryMarketState = ReturnType<typeof useAccessoryMarket>;

export function AccessoryMarket({ market, loading }: { market: AccessoryMarketState; loading: boolean }) {
  const { stats, filteredGroups, visibleGroups, resetPaging } = market;
  return (
    <section className="accessory-market" aria-label="Tennis racquet accessories categorized by product type">
      <div className="accessory-market-summary">
        <div><span>ACCESSORY PRODUCTS</span><strong>{stats.products}</strong><small>Consolidated across retailers</small></div>
        <div><span>RETAILER OFFERS</span><strong>{stats.offers}</strong><small>Current in-stock items</small></div>
        <div><span>RETAILERS</span><strong>{stats.retailers}</strong><small>Canadian public catalogues</small></div>
        <div><span>CATEGORIES</span><strong>{stats.categories}</strong><small>Available in this view</small></div>
      </div>
      <div className="accessory-controls" aria-label="Filter tennis accessories">
        <div className="catalogue-control-copy">
          <span className="settings-label">FILTER ACCESSORIES</span>
          <strong>{filteredGroups.length} results</strong>
        </div>
        <label className="accessory-search"><span>Search</span><input type="search" value={market.search} placeholder="Bags, grips, grommets…" onChange={(event) => { market.setSearch(event.target.value); resetPaging(); }} /></label>
        <label><span>Category</span><select value={market.categoryFilter} onChange={(event) => { market.setCategoryFilter(event.target.value as AccessoryCategoryFilter); resetPaging(); }}>
          <option value="all">All accessory types</option>
          {accessoryCategoryOrder.map((category) => <option value={category} key={category}>{category}</option>)}
        </select></label>
        <label><span>Brand</span><select value={market.brandFilter} onChange={(event) => { market.setBrandFilter(event.target.value); resetPaging(); }}>
          <option value="all">All brands</option>
          {market.availableBrands.map((brand) => <option value={brand} key={brand}>{brand}</option>)}
        </select></label>
        <label><span>Sort</span><select value={market.sort} onChange={(event) => market.setSort(event.target.value as AccessorySort)}>
          <option value="featured">Category &amp; brand</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="discount">Biggest savings</option>
        </select></label>
        {(market.categoryFilter !== "all" || market.brandFilter !== "all" || market.search || market.sort !== "featured") && <button className="clear-catalogue" onClick={() => { market.setCategoryFilter("all"); market.setBrandFilter("all"); market.setSearch(""); market.setSort("featured"); resetPaging(); }}>Clear</button>}
      </div>
      <div className="accessory-category-sections">
        {market.groupsByCategory.map((section) => (
          <section className="accessory-category-section" key={section.category}>
            <div className="accessory-category-heading">
              <div><span>ACCESSORY TYPE</span><h3>{section.category}</h3></div>
              <b>{section.groups.length} {section.groups.length === 1 ? "product" : "products"}</b>
            </div>
            <div className="accessory-grid">
              {section.groups.map((group) => <AccessoryCard group={group} key={group.key} />)}
            </div>
          </section>
        ))}
      </div>
      {visibleGroups.length < filteredGroups.length && (
        <button className="catalogue-more" onClick={() => market.setVisibleCount((count) => count + accessoryPageSize)}>
          Show more accessories <span>{visibleGroups.length} of {filteredGroups.length} shown</span>
        </button>
      )}
      {!loading && !filteredGroups.length && <div className="special-market-empty"><strong>No in-stock accessories match those filters.</strong><span>Try another category or brand; Baseline refreshes accessory catalogues every three hours.</span></div>}
    </section>
  );
}

function AccessoryCard({ group }: { group: AccessoryGroup }) {
  const offer = group.bestOffer;
  const discounted = offer.compareAtPrice != null && offer.compareAtPrice > (offer.currentPrice ?? 0);
  return (
    <article className={`accessory-card ${offer.sourceState === "stale" ? "stale-offer-card" : ""}`}>
      <div className="accessory-card-top">
        <span className="accessory-brand">{group.brand}</span>
        <span className="accessory-category-pill">{group.category}</span>
      </div>
      <div className="accessory-card-identity">
        <div className="accessory-mark" aria-hidden="true"><span>{accessoryCategoryMarks[group.category]}</span><i /></div>
        <div><h4>{group.title}</h4><span className="accessory-detail">{group.detail}</span></div>
      </div>
      <div className="accessory-card-price">
        <span><small>{offer.sourceState === "stale" ? "LAST VERIFIED" : "BEST PRICE"}</small><strong>{money.format(offer.currentPrice ?? 0)}</strong></span>
        <span><small>AT</small><b>{offer.store}</b></span>
      </div>
      {discounted && <div className="accessory-saving"><del>{money.format(offer.compareAtPrice ?? 0)}</del><strong>Save {Math.round((1 - (offer.currentPrice ?? 0) / (offer.compareAtPrice ?? 1)) * 100)}%</strong></div>}
      <details className="accessory-retailers">
        <summary>Compare {group.offers.length} {group.offers.length === 1 ? "offer" : "offers"}</summary>
        <div>
          {group.offers.map((retailerOffer) => (
            <a href={outboundHref(retailerOffer.id)} target="_blank" rel={outboundRel} key={retailerOffer.id}>
              <span><strong>{retailerOffer.store}</strong><small>{retailerOffer.detail}{retailerOffer.sourceState === "stale" ? ` · last verified ${relativeTime(retailerOffer.lastChecked)}` : ""}</small></span>
              <b>{money.format(retailerOffer.currentPrice ?? 0)}</b>
              <i aria-hidden="true">↗</i>
            </a>
          ))}
        </div>
      </details>
    </article>
  );
}
