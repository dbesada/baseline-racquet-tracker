"use client";

import { hasAffiliateLinks } from "./affiliate-disclosure";
import { AffiliateNote } from "./AffiliateNote";
import type { Dashboard, OpportunityMode, RacquetSpec } from "./baseline-types";
import { money, outboundHref, outboundRel, relativeTime } from "./baseline-catalogue";
import type { Opportunity } from "./dashboard-insights";
import { PatternBadge, RacquetName } from "./racquet-visuals";

export function RetailHero({ data, loading, checking, error, opportunities, opportunityMode, specs, showStartHere, onCheckNow, onOpportunityModeChange, onShowRetailers, onOpenRacquet, onStartCoach, onBrowseRacquets, onHideStartHere }: {
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
  onOpenRacquet: (modelKey: string) => void;
  showStartHere: boolean;
  onStartCoach: () => void;
  onBrowseRacquets: () => void;
  onHideStartHere: () => void;
}) {
  const selected = opportunities.find((choice) => choice.mode === opportunityMode) ?? opportunities[0] ?? null;
  return (
    <section className="hero" id="top">
      <div className="hero-copy">
        <p className="eyebrow">CANADIAN RACQUET PRICE TRACKER</p>
        <h1>Wait for the<br /><em>right bounce.</em></h1>
        <p className="lede">Baseline compares tennis racquet prices across Canadian stores every 3 hours, so you can see who has the lowest price before you buy.</p>
        <div className="hero-actions">
          {!data || data.publicPreview ? <span className="public-refresh-note">Prices refresh automatically<br /><strong>Every 3 hours</strong></span> : <button className="check-button" onClick={onCheckNow} disabled={checking}>
            <span className={checking ? "spin" : ""} aria-hidden="true">↻</span>
            {checking ? "Checking stores…" : "Check prices now"}
          </button>}
          <span className="last-check">Last checked<br /><strong>{loading ? "Loading…" : relativeTime(data?.lastCheck?.checkedAt)}</strong></span>
        </div>
        <AffiliateNote show={hasAffiliateLinks(data)} />
        {showStartHere && <div className="start-here">
          <div>
            <strong>New to tennis gear?</strong>
            <span>Answer a few quick questions and Baseline Coach will suggest racquets that suit your game.</span>
          </div>
          <div className="start-here-actions">
            <button className="start-here-primary" onClick={onStartCoach} data-analytics="start_here" data-analytics-detail="coach">Help me choose</button>
            <button className="start-here-secondary" onClick={onBrowseRacquets} data-analytics="start_here" data-analytics-detail="browse">I know what I want</button>
          </div>
          <button className="start-here-close" onClick={onHideStartHere} data-analytics="start_here" data-analytics-detail="hide" aria-label="Hide this tip">×</button>
        </div>}
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
            <strong className="opportunity-model"><RacquetName modelKey={selected.offer.modelKey} name={data?.modelNames[selected.offer.modelKey] ?? selected.offer.title} onOpen={onOpenRacquet} /></strong>
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
          <span><strong>{data?.dropsLast24Hours ?? 0}</strong> price drops, last 24h</span>
          <span><strong>{data?.lastCheck?.offersFound ?? 0}</strong> prices checked</span>
          <span><strong>{data?.lastCheck?.storesChecked ?? 0}</strong> stores checked</span>
        </div>
      </div>
    </section>
  );
}

export function SourceHealth({ data }: { data: Dashboard | null }) {
  if (!data?.sourceHealth) return null;
  return <div className={`source-health ${data.sourceHealth.failures ? "partial" : "healthy"}`} aria-label="Price data health">
    <span className="source-health-state"><i />{data.sourceHealth.failures ? "Some stores still updating" : "All stores up to date"}</span>
    <span><strong>{data.sourceHealth.freshOffers}</strong> current prices</span>
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
