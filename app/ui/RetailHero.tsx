"use client";

import type { Dashboard, OpportunityMode, RacquetSpec } from "./baseline-types";
import { money, outboundHref, outboundRel, relativeTime } from "./baseline-catalogue";
import type { Opportunity } from "./dashboard-insights";
import { PatternBadge } from "./racquet-visuals";

export function RetailHero({ data, loading, checking, error, opportunities, opportunityMode, specs, onCheckNow, onOpportunityModeChange, onShowRetailers }: {
  data: Dashboard | null;
  loading: boolean;
  checking: boolean;
  error: string;
  opportunities: Opportunity[];
  opportunityMode: OpportunityMode;
  specs: Record<string, RacquetSpec>;
  onCheckNow: () => void;
  onOpportunityModeChange: (mode: OpportunityMode) => void;
  onShowRetailers: (modelKey: string) => void;
}) {
  const selected = opportunities.find((choice) => choice.mode === opportunityMode) ?? opportunities[0] ?? null;
  return (
    <section className="hero" id="top">
      <div className="hero-copy">
        <p className="eyebrow">CANADIAN RACQUET PRICE TRACKER</p>
        <h1>Wait for the<br /><em>right bounce.</em></h1>
        <p className="lede">Baseline watches the frames on your shortlist, checks enabled Canadian retailers every 3 hours, and calls the shot when the price drops.</p>
        <div className="hero-actions">
          {data?.publicPreview ? <span className="public-refresh-note">Prices refresh automatically<br /><strong>Every 3 hours</strong></span> : <button className="check-button" onClick={onCheckNow} disabled={checking}>
            <span className={checking ? "spin" : ""} aria-hidden="true">↻</span>
            {checking ? "Checking stores…" : "Check prices now"}
          </button>}
          <span className="last-check">Last checked<br /><strong>{relativeTime(data?.lastCheck?.checkedAt)}</strong></span>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
      <div className="court-card opportunity-court" aria-label="Best opportunity right now">
        <div className="court-lines"><span /><span /><span /></div>
        <div className="opportunity-panel">
          <span className="opportunity-kicker">BEST PRICE FINDER</span>
          <div className="opportunity-modes" aria-label="Choose best-price ranking">
            {opportunities.map((choice) => <button key={choice.mode} className={selected?.mode === choice.mode ? "active" : ""} onClick={() => onOpportunityModeChange(choice.mode)}>{choice.label}</button>)}
          </div>
          {selected ? <>
            <strong className="opportunity-model">{data?.modelNames[selected.offer.modelKey] ?? selected.offer.title}</strong>
            <div className="opportunity-price">
              <strong>{money.format(selected.offer.currentPrice ?? 0)}</strong>
              <span>at {selected.offer.store}</span>
            </div>
            <div className="opportunity-badges">
              <PatternBadge pattern={specs[selected.offer.modelKey]?.pattern} compact />
              {selected.watchlist && <span className={selected.delta <= 0 ? "target-hit" : ""}>
                {money.format(Math.abs(selected.delta))} {selected.delta <= 0 ? "below target" : "above target"}
              </span>}
              <span>{selected.stores} {selected.stores === 1 ? "retailer" : "retailers"}</span>
              {selected.mode === "tour" && (selected.tourPresence ?? 0) > 0 && <span>{selected.tourPresence} reported tour players</span>}
              {Number.isFinite(selected.offer.compareAtPrice) && selected.offer.currentPrice !== null
                && (selected.offer.compareAtPrice ?? 0) > 0
                && selected.offer.compareAtPrice > selected.offer.currentPrice
                && <span>{Math.round((1 - selected.offer.currentPrice / selected.offer.compareAtPrice) * 100)}% off retail</span>}
            </div>
            <div className="opportunity-actions">
              <a className="opportunity-link" href={outboundHref(selected.offer.id)} target="_blank" rel={outboundRel}>View deal <span aria-hidden="true">↗</span></a>
              <button className="opportunity-compare" onClick={() => onShowRetailers(selected.offer.modelKey)}>All retailers</button>
            </div>
          </> : <p className="opportunity-empty">{loading ? "Finding today’s best opportunity…" : "No verified in-stock opportunity yet."}</p>}
        </div>
        <div className="summary-copy opportunity-stats">
          <span><strong>{data?.dropsLast24Hours ?? 0}</strong> drops in 24h</span>
          <span><strong>{data?.lastCheck?.offersFound ?? 0}</strong> verified listings</span>
          <span><strong>{data?.lastCheck?.storesChecked ?? 0}</strong> retailers checked</span>
        </div>
      </div>
    </section>
  );
}

export function SourceHealth({ data }: { data: Dashboard | null }) {
  if (!data?.sourceHealth) return null;
  return <div className={`source-health ${data.sourceHealth.failures ? "partial" : "healthy"}`} aria-label="Price data health">
    <span className="source-health-state"><i />{data.sourceHealth.failures ? "PARTIAL SCAN" : "ALL SYSTEMS LIVE"}</span>
    <span><strong>{data.sourceHealth.freshOffers}</strong> fresh offers</span>
    {!data.publicPreview && <details>
      <summary>Data details</summary>
      <div className="source-health-details">
        <span><strong>{data.sourceHealth.liveSources}/{data.sourceHealth.totalSources}</strong> sources responded</span>
        {data.sourceHealth.staleOffers > 0 && <span className="source-health-stale"><strong>{data.sourceHealth.staleOffers}</strong> last verified</span>}
        <span>Updated <strong>{relativeTime(data.lastCheck?.checkedAt)}</strong></span>
      </div>
    </details>}
  </div>;
}
