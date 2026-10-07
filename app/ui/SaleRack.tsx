"use client";

import Image from "next/image";
import { useState } from "react";
import { saleTitle } from "../lib/sale-rack";
import type { Offer } from "./baseline-types";
import { money, outboundHref, outboundRel } from "./baseline-catalogue";
import { TermHelp } from "./TermTip";

type SaleFilter = "all" | "unstrung" | "prestrung";
const salePageSize = 9;

// Discounted racquets that are not on the tracked list, cheapest first, with
// a filter for pre-strung (ready to play) and unstrung frames.
export function SaleRack({ offers, loading, gripSize, eyebrow, title }: {
  offers: Offer[];
  loading: boolean;
  gripSize: string;
  eyebrow: string;
  title: string;
}) {
  const [filter, setFilter] = useState<SaleFilter>("all");
  const [visible, setVisible] = useState(salePageSize);
  const preStrungCount = offers.filter((offer) => offer.preStrung).length;
  const shown = offers.filter((offer) => filter === "all" || (filter === "prestrung") === Boolean(offer.preStrung));
  const choose = (next: SaleFilter) => { setFilter(next); setVisible(salePageSize); };
  return <div className="sale-section">
    <div className="sale-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <span className="sale-note">Your grip ({gripSize}) · new · in stock</span>
    </div>
    {preStrungCount > 0 && preStrungCount < offers.length && <div className="sale-filters" role="group" aria-label="Show sale racquets">
      {([["all", "All", offers.length], ["unstrung", "Unstrung frames", offers.length - preStrungCount], ["prestrung", "Pre-strung", preStrungCount]] as const).map(([key, label, count]) =>
        <button key={key} className={filter === key ? "active" : ""} aria-pressed={filter === key} onClick={() => choose(key)} data-analytics="sale_filter" data-analytics-detail={key}>{label} <span>{count}</span></button>)}
      <TermHelp term="prestrung" label="What is the difference between pre-strung and unstrung?" />
    </div>}
    <div className="sale-grid">
      {shown.slice(0, visible).map((offer) => {
        const saving = offer.compareAtPrice && offer.currentPrice ? offer.compareAtPrice - offer.currentPrice : 0;
        const percent = offer.compareAtPrice && offer.currentPrice ? Math.round((1 - offer.currentPrice / offer.compareAtPrice) * 100) : 0;
        return <a className={`sale-offer ${offer.imageUrl ? "has-photo" : ""}`} href={outboundHref(offer.id)} target="_blank" rel={outboundRel} key={offer.id}>
          {offer.imageUrl && <span className="sale-photo"><Image src={offer.imageUrl} alt="" width={72} height={96} unoptimized /></span>}
          <span className="sale-body">
            <span className="sale-store">{offer.store}</span>
            <strong title={offer.title}>{saleTitle(offer.title)}</strong>
            {offer.preStrung && <span className="sale-tag">Pre-strung · ready to play</span>}
            <span className="sale-prices"><b>{money.format(offer.currentPrice ?? 0)}</b>{offer.compareAtPrice != null && <del>{money.format(offer.compareAtPrice)}</del>}</span>
            {saving > 0 && <span className="sale-saving">Save {money.format(saving)} · {percent}% off</span>}
          </span>
          <span className="arrow" aria-hidden="true">↗</span>
        </a>;
      })}
    </div>
    {shown.length > visible && <button className="catalogue-more sale-more" onClick={() => setVisible((count) => count + salePageSize)}>
      Show more sale racquets <span>{visible} of {shown.length} shown</span>
    </button>}
    {!loading && !offers.length && <p className="empty sale-empty">No additional {gripSize} sale frames match the selected specs.</p>}
  </div>;
}
