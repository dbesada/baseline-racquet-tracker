"use client";

import { useMemo, useState } from "react";
import type { ShoeCourt, ShoeGender, ShoeGroup, ShoeOffer, ShoeSort } from "./baseline-types";
import { compareShoeSizes, freshnessRank, money, outboundHref, outboundRel, relativeTime, shoeCourtOrder, shoeFamilyKey, shoeGenderOrder, shoePageSize, shoeSizeKey } from "./baseline-catalogue";

// The price a store charges for the chosen size, or its lowest in-stock price
// when no size is chosen. Sizes can cost different amounts at the same store.
export function shoePriceFor(offer: ShoeOffer, size: string) {
  if (size === "all") return { price: offer.currentPrice, compareAtPrice: offer.compareAtPrice };
  const match = offer.sizes.find((entry) => entry.size === size);
  return match ? { price: match.price, compareAtPrice: match.compareAtPrice } : null;
}

// Read when the page first runs in the browser. The Shoes tab is never part
// of the server-rendered page, so this cannot cause a hydration mismatch.
// "Asics Men's Gel-Resolution X - White/Midnight" → model name and colourway.
export function shoeModelName(title: string) {
  return title.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s[-–]\s.*$/, "").trim() || title;
}

export function shoeColourway(title: string) {
  return title.match(/\s[-–]\s(.+)$/)?.[1]?.trim()
    ?? title.match(/\(([^)]+)\)/)?.[1]?.trim()
    ?? title.match(/\b([A-Za-z]+(?:\s[A-Za-z]+)?\/[A-Za-z/ -]+)$/)?.[1]?.trim()
    ?? "";
}

function readSavedSize() {
  if (typeof window === "undefined") return "all";
  try { return localStorage.getItem(shoeSizeKey) || "all"; } catch { return "all"; }
}

// Filter state lives in the parent (through this hook) so the choices survive
// switching to another tab and back.
export function useShoeMarket(shoeOffers: ShoeOffer[] | undefined) {
  const [genderFilter, setGenderFilter] = useState<"all" | ShoeGender>("all");
  const [courtFilter, setCourtFilter] = useState<"all" | ShoeCourt>("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [sizeFilter, setSizeFilterState] = useState(readSavedSize);
  const [sort, setSort] = useState<ShoeSort>("featured");
  const [visibleCount, setVisibleCount] = useState(shoePageSize);

  const setSizeFilter = (size: string) => {
    setSizeFilterState(size);
    try { if (size === "all") localStorage.removeItem(shoeSizeKey); else localStorage.setItem(shoeSizeKey, size); } catch { /* storage blocked: keep it for this visit */ }
  };

  const inStock = useMemo(() => (shoeOffers ?? []).filter((offer) => offer.inStock && offer.currentPrice !== null && offer.sizes.length), [shoeOffers]);
  const availableSizes = useMemo(() => [...new Set(inStock
    .filter((offer) => genderFilter === "all" || offer.gender === genderFilter)
    .flatMap((offer) => offer.sizes.map((entry) => entry.size)))].sort(compareShoeSizes), [genderFilter, inStock]);
  const availableBrands = useMemo(() => [...new Set(inStock.map((offer) => offer.brand))]
    .sort((a, b) => a.localeCompare(b, "en-CA", { sensitivity: "base" })), [inStock]);

  const allGroups = useMemo<ShoeGroup[]>(() => {
    const grouped = new Map<string, ShoeOffer[]>();
    for (const offer of inStock) {
      if (!shoePriceFor(offer, sizeFilter)) continue;
      const key = shoeFamilyKey(offer);
      grouped.set(key, [...(grouped.get(key) ?? []), offer]);
    }
    return [...grouped.entries()].map(([key, offers]) => {
      const sorted = offers.sort((a, b) => freshnessRank(a) - freshnessRank(b)
        || (shoePriceFor(a, sizeFilter)?.price ?? Infinity) - (shoePriceFor(b, sizeFilter)?.price ?? Infinity)
        || a.store.localeCompare(b.store, "en-CA", { sensitivity: "base" }));
      const representative = [...offers].sort((a, b) => shoeModelName(a.title).length - shoeModelName(b.title).length)[0];
      const court = offers.find((offer) => offer.court !== "Not listed")?.court ?? "Not listed";
      return { key, title: shoeModelName(representative.title), brand: representative.brand, gender: representative.gender, court, offers: sorted, bestOffer: sorted[0] };
    });
  }, [inStock, sizeFilter]);

  const filteredGroups = useMemo(() => {
    const matches = allGroups.filter((group) => (genderFilter === "all" || group.gender === genderFilter)
      && (courtFilter === "all" || group.court === courtFilter)
      && (brandFilter === "all" || group.brand === brandFilter));
    const best = (group: ShoeGroup) => shoePriceFor(group.bestOffer, sizeFilter);
    return [...matches].sort((a, b) => {
      if (sort === "price-asc") return (best(a)?.price ?? Infinity) - (best(b)?.price ?? Infinity);
      if (sort === "price-desc") return (best(b)?.price ?? 0) - (best(a)?.price ?? 0);
      if (sort === "discount") {
        const saving = (group: ShoeGroup) => {
          const entry = best(group);
          return entry?.compareAtPrice && entry.price !== null && entry.compareAtPrice > entry.price ? (entry.compareAtPrice - entry.price) / entry.compareAtPrice : 0;
        };
        return saving(b) - saving(a) || (best(a)?.price ?? Infinity) - (best(b)?.price ?? Infinity);
      }
      return shoeGenderOrder.indexOf(a.gender) - shoeGenderOrder.indexOf(b.gender)
        || a.brand.localeCompare(b.brand, "en-CA", { sensitivity: "base" })
        || a.title.localeCompare(b.title, "en-CA", { sensitivity: "base" });
    });
  }, [allGroups, brandFilter, courtFilter, genderFilter, sizeFilter, sort]);
  const visibleGroups = filteredGroups.slice(0, visibleCount);
  const stats = useMemo(() => ({
    products: filteredGroups.length,
    offers: filteredGroups.reduce((total, group) => total + group.offers.length, 0),
    retailers: new Set(filteredGroups.flatMap((group) => group.offers.map((offer) => offer.store))).size,
    brands: new Set(filteredGroups.map((group) => group.brand)).size,
  }), [filteredGroups]);
  const filtered = genderFilter !== "all" || courtFilter !== "all" || brandFilter !== "all" || sort !== "featured";

  return {
    genderFilter, setGenderFilter, courtFilter, setCourtFilter, brandFilter, setBrandFilter, sizeFilter, setSizeFilter, sort, setSort, setVisibleCount,
    availableSizes, availableBrands, filteredGroups, visibleGroups, stats, filtered,
    resetPaging: () => setVisibleCount(shoePageSize),
  };
}

export type ShoeMarketState = ReturnType<typeof useShoeMarket>;

export function ShoeMarket({ market, loading }: { market: ShoeMarketState; loading: boolean }) {
  const { stats, filteredGroups, visibleGroups, resetPaging, sizeFilter } = market;
  return (
    <section className="accessory-market shoe-market" aria-label="Tennis shoes by fit, court type and size">
      <div className="accessory-market-summary">
        <div><span>SHOE MODELS</span><strong>{stats.products}</strong><small>{sizeFilter === "all" ? "In stock in at least one size" : `In stock in size ${sizeFilter}`}</small></div>
        <div><span>RETAILER OFFERS</span><strong>{stats.offers}</strong><small>Current in-stock listings</small></div>
        <div><span>RETAILERS</span><strong>{stats.retailers}</strong><small>Canadian public catalogues</small></div>
        <div><span>BRANDS</span><strong>{stats.brands}</strong><small>Tennis shoe makers</small></div>
      </div>
      <div className="accessory-controls" aria-label="Filter tennis shoes">
        <div className="catalogue-control-copy"><span className="settings-label">FILTER TENNIS SHOES</span><strong>{filteredGroups.length} results</strong></div>
        <label><span>Fit</span><select id="shoe-gender" value={market.genderFilter} onChange={(event) => { market.setGenderFilter(event.target.value as "all" | ShoeGender); resetPaging(); }}>
          <option value="all">All fits</option>{shoeGenderOrder.map((gender) => <option value={gender} key={gender}>{gender === "Not listed" ? "Fit not listed" : gender}</option>)}
        </select></label>
        <label><span>Your size (US)</span><select id="shoe-size" value={sizeFilter} onChange={(event) => { market.setSizeFilter(event.target.value); resetPaging(); }}>
          <option value="all">Any size</option>{market.availableSizes.map((size) => <option value={size} key={size}>{size}</option>)}
          {sizeFilter !== "all" && !market.availableSizes.includes(sizeFilter) && <option value={sizeFilter}>{sizeFilter}</option>}
        </select></label>
        <label><span>Court</span><select id="shoe-court" value={market.courtFilter} onChange={(event) => { market.setCourtFilter(event.target.value as "all" | ShoeCourt); resetPaging(); }}>
          <option value="all">All courts</option>{shoeCourtOrder.map((court) => <option value={court} key={court}>{court === "Not listed" ? "Court type not listed" : court}</option>)}
        </select></label>
        <label><span>Brand</span><select id="shoe-brand" value={market.brandFilter} onChange={(event) => { market.setBrandFilter(event.target.value); resetPaging(); }}>
          <option value="all">All brands</option>{market.availableBrands.map((brand) => <option value={brand} key={brand}>{brand}</option>)}
        </select></label>
        <label><span>Sort</span><select id="shoe-sort" value={market.sort} onChange={(event) => market.setSort(event.target.value as ShoeSort)}>
          <option value="featured">Fit &amp; brand</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="discount">Biggest savings</option>
        </select></label>
        {market.filtered && <button className="clear-catalogue" onClick={() => { market.setGenderFilter("all"); market.setCourtFilter("all"); market.setBrandFilter("all"); market.setSort("featured"); resetPaging(); }}>Clear</button>}
      </div>
      <div className="accessory-grid shoe-grid">
        {visibleGroups.map((group) => {
          const offer = group.bestOffer;
          const priced = shoePriceFor(offer, sizeFilter);
          const discounted = priced?.compareAtPrice != null && priced.compareAtPrice > (priced.price ?? 0);
          return (
            <article className={`accessory-card shoe-card ${offer.sourceState === "stale" ? "stale-offer-card" : ""}`} key={group.key}>
              <div className="accessory-card-top"><span className="accessory-brand">{group.brand}</span><span className="accessory-category-pill">{group.court === "Not listed" ? group.gender : `${group.gender} · ${group.court}`}</span></div>
              <div className="accessory-card-identity"><div className="accessory-mark shoe-mark" aria-hidden="true"><span>▲</span><i /></div><div><h4>{group.title}</h4><span className="accessory-detail">{(() => {
                const stores = new Set(group.offers.map((entry) => entry.store)).size;
                const where = `${stores} ${stores === 1 ? "store" : "stores"}`;
                return sizeFilter === "all" ? `${group.offers.length} ${group.offers.length === 1 ? "listing" : "listings"} at ${where}` : `Size ${sizeFilter} in stock at ${where}`;
              })()}</span></div></div>
              <div className="accessory-card-price"><span><small>{offer.sourceState === "stale" ? "LAST VERIFIED" : sizeFilter === "all" ? "FROM" : "BEST PRICE"}</small><strong>{money.format(priced?.price ?? 0)}</strong></span><span><small>AT</small><b>{offer.store}</b></span></div>
              {discounted && <div className="accessory-saving"><del>{money.format(priced?.compareAtPrice ?? 0)}</del><strong>Save {Math.round((1 - (priced?.price ?? 0) / (priced?.compareAtPrice ?? 1)) * 100)}%</strong></div>}
              <details className="accessory-retailers"><summary>Compare {group.offers.length} {group.offers.length === 1 ? "offer" : "offers"}</summary><div>
                {group.offers.map((retailerOffer) => {
                  const retailerPrice = shoePriceFor(retailerOffer, sizeFilter);
                  return <a href={outboundHref(retailerOffer.id)} target="_blank" rel={outboundRel} key={retailerOffer.id}><span><strong>{retailerOffer.store}</strong><small>{shoeColourway(retailerOffer.title) ? `${shoeColourway(retailerOffer.title)} · ` : ""}{sizeFilter === "all" ? `Sizes ${retailerOffer.sizes.map((entry) => entry.size).join(", ")}` : `Size ${sizeFilter}`}{retailerOffer.sourceState === "stale" ? ` · last verified ${relativeTime(retailerOffer.lastChecked)}` : ""}</small></span><b>{money.format(retailerPrice?.price ?? 0)}</b><i aria-hidden="true">↗</i></a>;
                })}
              </div></details>
            </article>
          );
        })}
      </div>
      {visibleGroups.length < filteredGroups.length && <button className="catalogue-more" onClick={() => market.setVisibleCount((count) => count + shoePageSize)}>Show more tennis shoes <span>{visibleGroups.length} of {filteredGroups.length} shown</span></button>}
      {!loading && !filteredGroups.length && <div className="special-market-empty"><strong>{sizeFilter === "all" ? "No in-stock tennis shoes match those filters." : `No tennis shoes in size ${sizeFilter} match those filters right now.`}</strong><span>Try another fit, court type or size; Baseline refreshes shoe catalogues every three hours.</span></div>}
    </section>
  );
}
