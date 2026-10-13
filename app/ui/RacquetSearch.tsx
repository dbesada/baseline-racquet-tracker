"use client";

import Image from "next/image";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Dashboard, RacquetSpec } from "./baseline-types";
import { modelBrand, modelImage, money } from "./baseline-catalogue";
import { searchRacquets } from "./racquet-search";

type SearchModel = { key: string; name: string; brand: string; price: number | null };

// A search box that finds any tracked racquet by name and opens its pop-up
// (specs and every store's price) in one step. Press "/" to jump to it.
export function RacquetSearch({ data, specs, onOpenRacquet }: {
  data: Dashboard | null;
  specs: Record<string, RacquetSpec>;
  onOpenRacquet: (modelKey: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  const models = useMemo<SearchModel[]>(() => {
    if (!data) return [];
    const best = new Map<string, number>();
    for (const offer of data.offers) {
      if (!offer.inStock || offer.currentPrice == null || offer.modelKey === "other-sale") continue;
      if (!best.has(offer.modelKey) || offer.currentPrice < (best.get(offer.modelKey) ?? Infinity)) best.set(offer.modelKey, offer.currentPrice);
    }
    return Object.entries(data.modelNames).map(([key, name]) => ({ key, name, brand: modelBrand(key) ?? "", price: best.get(key) ?? null }));
  }, [data]);
  const results = useMemo(() => searchRacquets(query, models) as SearchModel[], [query, models]);
  const open = focused && query.trim().length > 0;

  useEffect(() => {
    const focusOnSlash = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== "/" || event.metaKey || event.ctrlKey || target?.closest("input, textarea, select, [contenteditable]")) return;
      event.preventDefault();
      input.current?.focus();
    };
    window.addEventListener("keydown", focusOnSlash);
    return () => window.removeEventListener("keydown", focusOnSlash);
  }, []);

  const pick = (modelKey: string) => {
    onOpenRacquet(modelKey);
    setQuery("");
    input.current?.blur();
  };

  return <div className="racquet-search" role="search">
    <label className="racquet-search-field">
      <span aria-hidden="true">⌕</span>
      <input
        ref={input}
        type="search"
        value={query}
        placeholder="Search racquets, e.g. Pure Aero, Blade 98"
        aria-label="Search racquets by name"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && results[active] ? `${listId}-${results[active].key}` : undefined}
        autoComplete="off"
        enterKeyHint="search"
        onChange={(event) => { setQuery(event.target.value); setActive(0); }}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 150)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") { event.preventDefault(); setActive((index) => Math.min(index + 1, results.length - 1)); }
          if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => Math.max(index - 1, 0)); }
          if (event.key === "Enter" && results[active]) { event.preventDefault(); pick(results[active].key); }
          if (event.key === "Escape") { setQuery(""); input.current?.blur(); }
        }}
      />
    </label>
    {open && <ul className="racquet-search-results" id={listId} role="listbox" aria-label="Matching racquets">
      {results.length ? results.map((model, index) => {
        const spec = specs[model.key];
        return <li key={model.key} id={`${listId}-${model.key}`} role="option" aria-selected={index === active}>
          <button type="button" className={index === active ? "active" : ""} onMouseEnter={() => setActive(index)} onMouseDown={(event) => event.preventDefault()} onClick={() => pick(model.key)} data-analytics="search_pick" data-analytics-detail={model.key}>
            <span className="racquet-search-photo"><Image src={modelImage(model.key, spec?.imageUrl)} alt="" width={36} height={48} unoptimized /></span>
            <span className="racquet-search-name"><strong>{model.name}</strong><small>{[spec?.head, spec?.weight].filter(Boolean).join(" · ") || model.brand}</small></span>
            <span className="racquet-search-price">{model.price != null ? <><small>from</small> {money.format(model.price)}</> : <small>No stock right now</small>}</span>
          </button>
        </li>;
      }) : <li className="racquet-search-empty" role="option" aria-selected={false} aria-disabled="true">No racquet matches “{query.trim()}”. Try a shorter name, like “Speed” or “Clash”.</li>}
    </ul>}
  </div>;
}
