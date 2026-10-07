"use client";

import { useCallback, useMemo, useState } from "react";
import type { BrandViewKey, CatalogueMetric, CatalogueSort, Dashboard, GripSize, HeadSizeFilter, PatternFilter, RacquetSpec, TargetEditor, WeightFilter } from "./baseline-types";
import { accents, cataloguePageSize, featuredByBrand, gripOptions, matchesCatalogueFilters, maxCompareFrames, modelBrand, money, outboundHref, outboundRel, relativeTime, sortCatalogueKeys, specNumber, standardizedSpecDisplay, uniqueRetailerOffers, validationPresentation } from "./baseline-catalogue";
import { PatternBadge, RacquetImage, RacquetName } from "./racquet-visuals";

// Browse views that are not racquet lists.
const nonRacquetViews: BrandViewKey[] = ["special", "strings", "balls", "accessories", "guide", "string-guide"];

// Catalogue filter state lives in the parent (through this hook) so the
// choices survive switching to another tab and back.
export function useRacquetCatalogue(data: Dashboard | null, specs: Record<string, RacquetSpec>, metrics: Record<string, CatalogueMetric>, activeBrand: BrandViewKey) {
  const [headSizeFilter, setHeadSizeFilter] = useState<HeadSizeFilter>("all");
  const [weightFilter, setWeightFilter] = useState<WeightFilter>("all");
  const [patternFilter, setPatternFilter] = useState<PatternFilter>("all");
  const [sort, setSort] = useState<CatalogueSort>("featured");
  const [visibleCount, setVisibleCount] = useState(cataloguePageSize);

  const availableHeadSizes = useMemo(() => [...new Set(
    Object.values(specs)
      .map((spec) => specNumber(spec.head))
      .filter((size): size is number => Number.isFinite(size) && size >= 80 && size <= 140),
  )].sort((a, b) => a - b), [specs]);
  const filterModelKeys = useCallback((keys: string[]) => sortCatalogueKeys(
    keys.filter((key) => matchesCatalogueFilters(key, headSizeFilter, weightFilter, patternFilter, specs)),
    sort,
    specs,
    data?.modelNames ?? {},
    metrics,
  ), [metrics, sort, data?.modelNames, headSizeFilter, patternFilter, specs, weightFilter]);
  const brandModelKeys = useMemo(() => {
    if (activeBrand === "all") return data?.modelOrder ?? [];
    if (activeBrand === "catalogue") return (data?.modelOptions ?? []).map((option) => option.key);
    if (nonRacquetViews.includes(activeBrand)) return [];
    return (data?.modelOptions ?? []).filter((option) => modelBrand(option.key) === activeBrand).map((option) => option.key);
  }, [activeBrand, data]);
  const featuredModelKeys = useMemo(() => {
    if (activeBrand === "catalogue") return filterModelKeys(brandModelKeys);
    if (activeBrand === "all") return brandModelKeys;
    if (nonRacquetViews.includes(activeBrand)) return [];
    const brand = activeBrand as keyof typeof featuredByBrand;
    const preferred = data?.brandPicks?.[brand] ?? featuredByBrand[brand];
    return preferred.filter((key) => brandModelKeys.includes(key));
  }, [activeBrand, brandModelKeys, data, filterModelKeys]);
  const visibleFeaturedModelKeys = useMemo(() =>
    activeBrand === "catalogue" ? featuredModelKeys.slice(0, visibleCount) : featuredModelKeys,
  [activeBrand, visibleCount, featuredModelKeys]);
  const suggestedModelKeys = useMemo(() => {
    if (activeBrand === "all" || activeBrand === "catalogue" || nonRacquetViews.includes(activeBrand)) return [];
    const brand = activeBrand as keyof typeof featuredByBrand;
    return brandModelKeys.filter((key) => !(data?.brandPicks?.[brand] ?? featuredByBrand[brand]).includes(key));
  }, [activeBrand, brandModelKeys, data]);
  const saleOffers = useMemo(() => nonRacquetViews.includes(activeBrand)
    ? []
    : activeBrand === "all" || activeBrand === "catalogue"
    ? (data?.saleOffers ?? [])
    : (data?.saleOffers ?? []).filter((offer) => offer.title.toLowerCase().includes(activeBrand.toLowerCase())),
  [activeBrand, data]);

  return {
    headSizeFilter, setHeadSizeFilter, weightFilter, setWeightFilter, patternFilter, setPatternFilter, sort, setSort, setVisibleCount,
    availableHeadSizes, featuredModelKeys, visibleFeaturedModelKeys, suggestedModelKeys, saleOffers,
    resetPaging: () => setVisibleCount(cataloguePageSize),
    clearFilters: () => {
      setHeadSizeFilter("all");
      setWeightFilter("all");
      setPatternFilter("all");
      setSort("featured");
      setVisibleCount(cataloguePageSize);
    },
  };
}

export type RacquetCatalogueState = ReturnType<typeof useRacquetCatalogue>;

// What every racquet card needs from the screen around it.
export type RacquetCardContext = {
  data: Dashboard | null;
  specs: Record<string, RacquetSpec>;
  loading: boolean;
  activeBrand: BrandViewKey;
  compareKeys: string[];
  refreshingModels: Set<string>;
  targetEditor: TargetEditor;
  onToggleCompare: (modelKey: string) => void;
  onDealOpen: () => void;
  onShowRetailers: (modelKey: string) => void;
  onOpenRacquet: (modelKey: string) => void;
};

export function RacquetBrowser({ catalogue, cards, modelFetch, onGripSizeChange }: {
  catalogue: RacquetCatalogueState;
  cards: RacquetCardContext;
  modelFetch: { fetching: boolean; checking: boolean; message: string; onFetch: () => void };
  onGripSizeChange: (gripSize: GripSize) => void;
}) {
  const { data, loading, activeBrand } = cards;
  const { featuredModelKeys, visibleFeaturedModelKeys, suggestedModelKeys, saleOffers } = catalogue;
  return <>
    {activeBrand === "catalogue" && <CatalogueControls catalogue={catalogue} data={data} modelFetch={modelFetch} onGripSizeChange={onGripSizeChange} />}

    <div className="model-grid">
      {visibleFeaturedModelKeys.map((modelKey, index) => <ModelCard modelKey={modelKey} index={index} featured={activeBrand !== "all" && activeBrand !== "catalogue"} cards={cards} key={`${modelKey}-${index}`} />)}
    </div>
    {activeBrand === "catalogue" && visibleFeaturedModelKeys.length < featuredModelKeys.length && (
      <button className="catalogue-more" onClick={() => catalogue.setVisibleCount((count) => count + cataloguePageSize)}>
        Show 24 more <span>{visibleFeaturedModelKeys.length} of {featuredModelKeys.length} shown</span>
      </button>
    )}
    {!loading && featuredModelKeys.length === 0 && suggestedModelKeys.length === 0 && <p className="catalogue-empty">{activeBrand === "catalogue" ? "No market racquets match those specs. Try clearing a filter." : "No racquets are available in this section right now."}</p>}

    {activeBrand !== "all" && activeBrand !== "catalogue" && suggestedModelKeys.length > 0 && (
      <section className="brand-suggestions">
        <div className="sale-heading">
          <div><p className="eyebrow">MORE FROM {activeBrand.toUpperCase()}</p><h2>Other suggestions.</h2></div>
          <span className="sale-note">Tracked across enabled retailers</span>
        </div>
        <div className="suggestion-grid">
          {suggestedModelKeys.map((modelKey) => <SuggestionCard modelKey={modelKey} cards={cards} key={modelKey} />)}
        </div>
      </section>
    )}

    {activeBrand !== "catalogue" && !nonRacquetViews.includes(activeBrand) && <div className="sale-section">
      <div className="sale-heading">
        <div>
          <p className="eyebrow">{activeBrand === "all" ? "THE REST OF THE SALE RACK" : `${activeBrand.toUpperCase()} DEALS`}</p>
          <h2>{activeBrand === "all" ? "Other frames worth a look." : `More ${activeBrand} prices worth a look.`}</h2>
        </div>
        <span className="sale-note">{data?.gripSize ?? "L3"} only · new · in stock</span>
      </div>
      <div className="sale-grid">
        {saleOffers.map((offer) => (
          <a className="sale-offer" href={outboundHref(offer.id)} target="_blank" rel={outboundRel} key={offer.id}>
            <span className="sale-store">{offer.store}</span>
            <strong>{offer.title}</strong>
            <span className="sale-prices"><b>{money.format(offer.currentPrice ?? 0)}</b><del>{offer.compareAtPrice != null ? money.format(offer.compareAtPrice) : ""}</del><i>↓ {offer.compareAtPrice && offer.currentPrice ? Math.round((1 - offer.currentPrice / offer.compareAtPrice) * 100) : 0}%</i></span>
            <span className="arrow" aria-hidden="true">↗</span>
          </a>
        ))}
      </div>
      {!loading && !saleOffers.length && <p className="empty sale-empty">No additional {data?.gripSize ?? "L3"} sale frames match the selected specs.</p>}
    </div>}
  </>;
}

function CatalogueControls({ catalogue, data, modelFetch, onGripSizeChange }: {
  catalogue: RacquetCatalogueState;
  data: Dashboard | null;
  modelFetch: { fetching: boolean; checking: boolean; message: string; onFetch: () => void };
  onGripSizeChange: (gripSize: GripSize) => void;
}) {
  const resultCount = catalogue.featuredModelKeys.length;
  const { headSizeFilter, weightFilter, patternFilter, sort, resetPaging } = catalogue;
  return (
    <div className="catalogue-controls" aria-label="Filter and sort racquets">
      <div className="catalogue-control-copy">
        <span className="settings-label">FIND YOUR SPEC</span>
        <strong>{resultCount} {resultCount === 1 ? "racquet" : "racquets"}</strong>
      </div>
      <label><span>Head size</span><select value={headSizeFilter} onChange={(event) => { catalogue.setHeadSizeFilter(event.target.value as HeadSizeFilter); resetPaging(); }}>
        <option value="all">Any head size</option>{catalogue.availableHeadSizes.map((size) => <option value={String(size)} key={`head-${size}`}>{size} in²</option>)}
      </select></label>
      <label><span>Grip size</span><select value={data?.gripSize ?? "L3"} onChange={(event) => onGripSizeChange(event.target.value as GripSize)}>
        {gripOptions.map((option) => <option value={option.key} key={`filter-${option.key}`}>{option.key} — {option.inches}</option>)}
      </select></label>
      <label><span>Unstrung weight</span><select value={weightFilter} onChange={(event) => { catalogue.setWeightFilter(event.target.value as WeightFilter); resetPaging(); }}>
        <option value="all">Any weight</option><option value="light">Up to 295 g</option><option value="medium">296–300 g</option><option value="standard">301–305 g</option><option value="heavy">306 g and up</option>
      </select></label>
      <label><span>String pattern</span><select value={patternFilter} onChange={(event) => { catalogue.setPatternFilter(event.target.value as PatternFilter); resetPaging(); }}>
        <option value="all">Any pattern</option><option value="16x19">16 × 19 · open</option><option value="16x20">16 × 20 · tighter</option><option value="18x20">18 × 20 · dense</option><option value="other">Other patterns</option>
      </select></label>
      <label><span>Sort by</span><select value={sort} onChange={(event) => { catalogue.setSort(event.target.value as CatalogueSort); resetPaging(); }}>
        <optgroup label="Recommended"><option value="featured">Featured order</option><option value="availability">Most widely stocked</option><option value="tour-presence">Tour presence: most represented</option><option value="discount">Biggest current discount</option></optgroup>
        <optgroup label="Style cues"><option value="style-distinctive">Style: bold & distinctive</option><option value="style-understated">Style: clean & understated</option></optgroup>
        <optgroup label="Name & price"><option value="name-asc">Name: A to Z</option><option value="name-desc">Name: Z to A</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option></optgroup>
        <optgroup label="Specifications"><option value="stiffness-asc">Stiffness: softest to firmest</option><option value="stiffness-desc">Stiffness: firmest to softest</option><option value="head-asc">Head size: small to large</option><option value="head-desc">Head size: large to small</option><option value="weight-asc">Weight: light to heavy</option><option value="weight-desc">Weight: heavy to light</option></optgroup>
      </select></label>
      {!data?.publicPreview && <button className="model-fetch-button" onClick={modelFetch.onFetch} disabled={modelFetch.fetching || modelFetch.checking}>
        <span className={modelFetch.fetching ? "spin" : ""} aria-hidden="true">+</span>
        {modelFetch.fetching ? "Fetching models..." : "Fetch new models"}
      </button>}
      {(headSizeFilter !== "all" || weightFilter !== "all" || patternFilter !== "all" || sort !== "featured") && <button className="clear-catalogue" onClick={catalogue.clearFilters}>Clear</button>}
      {modelFetch.message && <p className="model-fetch-status" aria-live="polite">{modelFetch.message}</p>}
      {sort === "availability" && <p className="catalogue-sort-note">Ranks distinct Canadian retailers with an in-stock listing. Comparable unit-sales totals are not publicly reported.</p>}
      {sort === "tour-presence" && <p className="catalogue-sort-note">Ranks manufacturer-reported professional representation for each endorsed racquet line.</p>}
      {(sort === "style-distinctive" || sort === "style-understated") && <p className="catalogue-sort-note">Style cues use the verified colour, model name and edition language where available. They are not a claim that one racquet looks better than another.</p>}
    </div>
  );
}

function ModelCard({ modelKey, index, featured, cards }: { modelKey: string; index: number; featured: boolean; cards: RacquetCardContext }) {
  const { data, specs, loading, activeBrand, compareKeys, targetEditor } = cards;
  const spec = specs[modelKey];
  const offers = (data?.offers ?? []).filter((offer) => offer.modelKey === modelKey);
  const inStock = offers.filter((offer) => offer.inStock && offer.currentPrice !== null)
    .sort((a, b) => (a.currentPrice ?? Infinity) - (b.currentPrice ?? Infinity));
  const release = data?.modelOptions.find((option) => option.key === modelKey);
  const preorderOffers = offers.filter((offer) => offer.currentPrice !== null && /pre[- ]?order|preorder|reserve now|coming soon/i.test(offer.title));
  const available = uniqueRetailerOffers([...inStock, ...preorderOffers]);
  const best = available[0];
  const target = data?.targets[modelKey] ?? 0;
  const belowTarget = Boolean(best && best.currentPrice !== null && best.currentPrice <= target);
  const history = (data?.history ?? []).filter((row) => row.modelKey === modelKey).slice(0, 8).reverse();
  const max = Math.max(...history.map((row) => row.price), 1);
  const min = Math.min(...history.map((row) => row.price), max);
  const selected = compareKeys.includes(modelKey);
  const compareFull = compareKeys.length >= maxCompareFrames && !selected;
  const validation = validationPresentation(data?.specValidation?.[modelKey]);
  return (
    <article className={`model-card ${accents[modelKey] ?? "blue"}`} style={{ "--delay": `${index * 70}ms` } as React.CSSProperties}>
      <div className="card-top">
        <span className="model-number">{featured && activeBrand !== "all" ? "FEATURED" : String(index + 1).padStart(2, "0")}</span>
        <div className="card-controls">
          <button className={`compare-toggle ${selected ? "selected" : ""}`} disabled={compareFull} onClick={() => cards.onToggleCompare(modelKey)}>{selected ? "✓ Compare" : "+ Compare"}</button>
          <span className={`deal-pill ${belowTarget ? "hit" : release?.releaseStatus === "preorder" ? "preorder" : release?.releaseStatus === "new" ? "new-release" : ""}`}>{belowTarget ? "Target hit" : release?.releaseLabel ?? "Watching"}</span>
        </div>
      </div>
      <div className="model-identity">
        <div><span className="brand-kicker">{modelBrand(modelKey)}</span><h3><RacquetName modelKey={modelKey} name={data?.modelNames[modelKey] ?? modelKey} onOpen={cards.onOpenRacquet} /></h3>{spec && <span className="card-specs">{[standardizedSpecDisplay("head", spec.head, false), standardizedSpecDisplay("weight", spec.weight, false), spec.stiffness].filter(Boolean).join(" · ")}</span>}<PatternBadge pattern={spec?.pattern} />{cards.refreshingModels.has(modelKey) && <span className="model-refresh-state" role="status"><i />Refreshing specs &amp; photo…</span>}{activeBrand === "catalogue" && <span className="card-spec-source"><span>Specs: {spec?.source ?? "Catalogue fallback"}</span><i className={`spec-validation ${validation.tone}`}>{validation.label}</i></span>}</div>
        <RacquetImage modelKey={modelKey} spec={spec} className="model-thumbnail" width={122} height={158} alt={`${data?.modelNames[modelKey] ?? modelKey} racquet`} sizes="122px" onPreview={cards.onOpenRacquet} action="details" />
      </div>
      <div className="price-row">
        <div><span className="price-label">{best?.sourceState === "stale" ? "LAST VERIFIED PRICE" : release?.releaseStatus === "preorder" ? "BEST PRE-ORDER PRICE" : "BEST IN-STOCK PRICE"}</span><strong className="price">{best?.currentPrice != null ? money.format(best.currentPrice) : "—"}</strong></div>
        <div className="sparkbars" aria-label="Recent lowest price trend">
          {history.length ? history.map((row, i) => <i key={`${row.checkedAt}-${i}`} style={{ height: `${28 + ((max - row.price) / Math.max(max - min, 1)) * 42}%` }} />) : <span>No history yet</span>}
        </div>
      </div>
      <div className="target-row">
        <span>Alert me under</span>
        {targetEditor.editingKey === modelKey ? (
          <form onSubmit={(event) => { event.preventDefault(); targetEditor.save(modelKey); }}>
            <label><span>$</span><input autoFocus inputMode="decimal" value={targetEditor.draft} onChange={(event) => targetEditor.setDraft(event.target.value)} aria-label="Target price in Canadian dollars" /></label>
            <button type="submit">Save</button>
          </form>
        ) : <button className="target-button" onClick={() => targetEditor.start(modelKey, target)}>{money.format(target)} <span>edit</span></button>}
      </div>
      <div className="offers">
        {loading ? <div className="loading-line" /> : available.length ? available.slice(0, 3).map((offer, offerIndex) => {
          const dropped = offer.previousPrice !== null && offer.currentPrice !== null && offer.currentPrice < offer.previousPrice;
          return <a href={outboundHref(offer.id)} target="_blank" rel={outboundRel} className="offer" key={offer.id} onClick={cards.onDealOpen}>
            <span className="rank">{offerIndex + 1}</span><span className="store"><strong>{offer.store}</strong><small>{offer.sourceState === "stale" ? `Last verified ${relativeTime(offer.lastChecked)}` : offer.gripSizes.length ? `${offer.gripSizes.length} grip sizes` : "Check grip sizes"}</small></span>
            <span className="offer-price"><strong>{money.format(offer.currentPrice ?? 0)}</strong>{dropped && <small>↓ {money.format((offer.previousPrice ?? 0) - (offer.currentPrice ?? 0))}</small>}</span><span className="arrow" aria-hidden="true">↗</span>
          </a>;
        }) : <p className="empty">{release?.releaseStatus === "preorder" ? "No Canadian pre-order match found yet. Baseline will keep checking." : "No in-stock match found today."}</p>}
      </div>
      {available.length > 0 && <button className="all-retailers-button" onClick={() => cards.onShowRetailers(modelKey)}>
        <span>Browse every retailer</span><strong>{available.length} {available.length === 1 ? "store" : "stores"}</strong><i aria-hidden="true">→</i>
      </button>}
    </article>
  );
}

function SuggestionCard({ modelKey, cards }: { modelKey: string; cards: RacquetCardContext }) {
  const { data, specs, compareKeys } = cards;
  const best = (data?.offers ?? [])
    .filter((offer) => offer.modelKey === modelKey && offer.inStock && offer.currentPrice !== null)
    .sort((a, b) => (a.currentPrice ?? Infinity) - (b.currentPrice ?? Infinity))[0];
  const selected = compareKeys.includes(modelKey);
  return (
    <article className="suggestion-card">
      <RacquetImage modelKey={modelKey} spec={specs[modelKey]} className="suggestion-image" width={66} height={88} alt={`${data?.modelNames[modelKey] ?? modelKey} racquet`} onPreview={cards.onOpenRacquet} action="details" />
      <div><span>{modelBrand(modelKey)}</span><strong><RacquetName modelKey={modelKey} name={data?.modelNames[modelKey] ?? modelKey} onOpen={cards.onOpenRacquet} /></strong><small>{best?.currentPrice != null ? `From ${money.format(best.currentPrice)}` : "Watching for stock"}</small><PatternBadge pattern={specs[modelKey]?.pattern} compact /></div>
      <button className={`compare-toggle ${selected ? "selected" : ""}`} disabled={compareKeys.length >= maxCompareFrames && !selected} onClick={() => cards.onToggleCompare(modelKey)}>{selected ? "✓ Added" : "+ Compare"}</button>
    </article>
  );
}
