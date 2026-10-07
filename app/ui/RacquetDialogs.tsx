"use client";

import Image from "next/image";
import { useState } from "react";
import { hasAffiliateLinks } from "./affiliate-disclosure";
import { AffiliateNote } from "./AffiliateNote";
import type { Dashboard, Offer, RacquetSpec } from "./baseline-types";
import { maxCompareFrames, modelBrand, modelImage, money, outboundHref, outboundRel, patternPresentation, relativeTime, standardizedSpecDisplay, validationPresentation } from "./baseline-catalogue";
import { racquetHash } from "./racquet-link";
import { PatternBadge, RacquetImage } from "./racquet-visuals";

const comparisonRows: Array<[string, keyof RacquetSpec]> = [
  ["Head size", "head"], ["Length", "length"], ["Unstrung weight", "weight"], ["Strung weight", "strungWeight"], ["Unstrung balance", "balance"], ["Strung balance", "strungBalance"], ["Swingweight", "swingweight"], ["Stiffness / flex", "stiffness"], ["Beam width", "beam"], ["Composition", "composition"], ["String pattern", "pattern"], ["Grip sizes", "gripSizes"], ["Recommended strings", "recommendedStrings"], ["Recommended tension", "tension"], ["Colour", "color"], ["Made in", "madeIn"], ["Product code", "productCode"], ["Notable player (endorsed line)", "notablePlayer"], ["Playing profile", "profile"],
];

const comparisonNote = "Official manufacturer specifications are the primary record and are independently checked against matching Canadian retailer listings. Measurements use one consistent format; secondary units are shown for convenience. Strung measurements and RA can vary by setup, sample, and generation.";

// Closes a dialog when the click lands on the backdrop itself, not the panel.
const closeOnBackdrop = (close: () => void) => (event: React.MouseEvent) => { if (event.target === event.currentTarget) close(); };

export function ImagePreviewDialog({ modelKey, modelName, spec, onClose }: { modelKey: string; modelName: string; spec?: RacquetSpec; onClose: () => void }) {
  const image = modelImage(modelKey, spec?.imageUrl);
  const pending = image.includes("racquet-photo-pending.svg");
  return <div className="image-preview-backdrop" role="presentation" onMouseDown={closeOnBackdrop(onClose)}>
    <section className="image-preview-modal" role="dialog" aria-modal="true" aria-labelledby="image-preview-title">
      <button className="image-preview-close" onClick={onClose} aria-label="Close racquet photo">×</button>
      <div className="image-preview-image"><Image src={image} alt={`${modelName} racquet`} width={420} height={560} sizes="(max-width: 700px) 72vw, 420px" unoptimized /></div>
      <div className="image-preview-copy">
        <span>{modelBrand(modelKey)}</span>
        <h2 id="image-preview-title">{modelName}</h2>
        <p>{pending ? "A model-specific photo is still being verified. Baseline will not substitute another racquet’s photo." : spec?.imageSource ? `Photo from ${spec.imageSource}’s product listing.` : spec?.imageUrl?.startsWith("https://") ? "Current photo supplied by the verified product source." : "Model-specific catalogue photo."}</p>
        {spec?.sourceUrl && <a href={spec.sourceUrl} target="_blank" rel="noreferrer">Open specification source ↗</a>}
      </div>
    </section>
  </div>;
}

// One spec value as the comparison table and the racquet pop-up show it.
function SpecValue({ field, spec }: { field: keyof RacquetSpec; spec?: RacquetSpec }) {
  if (field === "pattern") return patternPresentation(spec?.pattern) ? <PatternBadge pattern={spec?.pattern} /> : <>—</>;
  return <>{standardizedSpecDisplay(field, spec?.[field]) ?? (field === "stiffness" ? "Not published" : "—")}</>;
}

export type RacquetDialogTab = "specs" | "retailers";

// Copies the racquet's shareable link (#racquet-<model key>).
function CopyRacquetLink({ modelKey }: { modelKey: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const link = `${window.location.origin}${window.location.pathname}${racquetHash(modelKey)}`;
    navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }, () => window.prompt?.("Copy this link", link));
  };
  return <button className="racquet-dialog-compare" onClick={copy}>{copied ? "Link copied" : "Copy link"}</button>;
}

// A racquet's own pop-up: its full specifications and every retailer's price.
// Opened from a racquet's name or photo (Specs tab) or "Browse every retailer"
// (Retailers tab).
export function RetailerDialog({ modelKey, data, offers, spec, tab, compared, compareFull, onTabChange, onToggleCompare, onPreviewImage, onClose }: {
  modelKey: string;
  data: Dashboard | null;
  offers: Offer[];
  spec?: RacquetSpec;
  tab: RacquetDialogTab;
  compared: boolean;
  compareFull: boolean;
  onTabChange: (tab: RacquetDialogTab) => void;
  onToggleCompare: (modelKey: string) => void;
  onPreviewImage: (modelKey: string) => void;
  onClose: () => void;
}) {
  const modelName = data?.modelNames[modelKey] ?? modelKey;
  const target = data?.targets[modelKey] ?? 0;
  const validation = validationPresentation(data?.specValidation?.[modelKey]);
  return (
    <div className="retailer-modal-backdrop" role="presentation" onMouseDown={closeOnBackdrop(onClose)}>
      <section className="retailer-modal" role="dialog" aria-modal="true" aria-labelledby="retailer-modal-title">
        <div className="retailer-modal-head">
          <div className="retailer-modal-identity">
            <RacquetImage modelKey={modelKey} spec={spec} className="retailer-modal-thumb" width={72} height={98} alt={`${modelName} racquet`} onPreview={onPreviewImage} />
             <div><span>{modelBrand(modelKey)} · {data?.gripSize ?? "L3"}</span><h2 id="retailer-modal-title">{modelName}</h2><PatternBadge pattern={spec?.pattern} /><p>{offers.length ? `${offers.length} verified ${offers.length === 1 ? "retailer" : "retailers"}, ranked by price` : "No verified in-stock retailer right now"}</p><AffiliateNote show={hasAffiliateLinks(data)} /></div>
          </div>
          <button className="retailer-modal-close" onClick={onClose} aria-label="Close racquet details">×</button>
        </div>
        <div className="racquet-dialog-bar">
          <div className="racquet-dialog-tabs" role="tablist" aria-label="Racquet details">
            <button role="tab" id="racquet-tab-specs" aria-selected={tab === "specs"} aria-controls="racquet-panel" className={tab === "specs" ? "active" : ""} onClick={() => onTabChange("specs")}>Specs</button>
            <button role="tab" id="racquet-tab-retailers" aria-selected={tab === "retailers"} aria-controls="racquet-panel" className={tab === "retailers" ? "active" : ""} onClick={() => onTabChange("retailers")}>Retailers{offers.length ? ` (${offers.length})` : ""}</button>
          </div>
          <div className="racquet-dialog-actions">
            <CopyRacquetLink modelKey={modelKey} />
            <button className={`racquet-dialog-compare ${compared ? "on" : ""}`} disabled={!compared && compareFull} onClick={() => onToggleCompare(modelKey)}>{compared ? "✓ In comparison" : compareFull ? "Comparison full" : "+ Compare"}</button>
          </div>
        </div>
        <div id="racquet-panel" role="tabpanel" aria-labelledby={tab === "specs" ? "racquet-tab-specs" : "racquet-tab-retailers"}>
        {tab === "specs" ? <>
          <div className="racquet-specs-layout">
          <RacquetImage modelKey={modelKey} spec={spec} className="racquet-dialog-photo" width={300} height={400} sizes="(max-width: 720px) 60vw, 300px" alt={`${modelName} racquet`} onPreview={onPreviewImage} />
          <dl className="racquet-spec-list">
            {/* One racquet: list only what is known (stiffness says when it isn't published). */}
            {comparisonRows.filter(([, field]) => field === "stiffness" || (field === "pattern" ? patternPresentation(spec?.pattern) : standardizedSpecDisplay(field, spec?.[field]))).map(([label, field]) => <div key={field}><dt>{label}</dt><dd><SpecValue field={field} spec={spec} /></dd></div>)}
            <div><dt>Independent validation</dt><dd><span className={`spec-validation ${validation.tone}`}>{validation.label}</span></dd></div>
            <div><dt>Specification source</dt><dd>{spec?.sourceUrl ? <a className="comparison-source" href={spec.sourceUrl} target="_blank" rel="noreferrer">{spec.source ?? "Manufacturer / retailer source"} ↗</a> : (spec?.source ?? "Catalogue fallback")}</dd></div>
          </dl>
          </div>
          <p className="retailer-modal-note">{comparisonNote}</p>
        </> : <>
        <div className="retailer-modal-summary">
          <div><span>Best price</span><strong>{offers[0]?.currentPrice != null ? money.format(offers[0].currentPrice) : "—"}</strong></div>
          <div><span>Your target</span><strong>{money.format(target)}</strong></div>
          <div><span>Price spread</span><strong>{offers.length > 1 ? money.format((offers.at(-1)?.currentPrice ?? 0) - (offers[0]?.currentPrice ?? 0)) : "—"}</strong></div>
        </div>
        <div className="retailer-modal-list">
          {offers.map((offer, index) => {
            const delta = (offer.currentPrice ?? 0) - target;
            return <a href={outboundHref(offer.id)} target="_blank" rel={outboundRel} className={`retailer-modal-row ${offer.sourceState === "stale" ? "stale" : ""}`} key={`${modelKey}-${offer.store}`}>
              <span className="retailer-modal-rank">{index + 1}</span>
              <span className="retailer-modal-store"><strong>{offer.store}</strong><small>{offer.gripSizes.length ? offer.gripSizes.join(", ") : "Confirm grip"} · {offer.sourceState === "stale" ? "last verified" : "checked"} {relativeTime(offer.lastChecked)}</small></span>
              <span className="retailer-modal-delta">{delta <= 0 ? `${money.format(Math.abs(delta))} under target` : `${money.format(delta)} over target`}</span>
              <span className="retailer-modal-price"><strong>{money.format(offer.currentPrice ?? 0)}</strong><small>{offer.currency ?? "CAD"}</small></span>
              <span aria-hidden="true">↗</span>
            </a>;
          })}
        </div>
        <p className="retailer-modal-note">Prices are ranked before shipping and tax. Open a retailer to confirm final grip stock and checkout total.</p>
        </>}
        </div>
      </section>
    </div>
  );
}

export function CompareTray({ compareKeys, modelNames, onRemove, onClear, onOpen }: {
  compareKeys: string[];
  modelNames: Record<string, string> | undefined;
  onRemove: (modelKey: string) => void;
  onClear: () => void;
  onOpen: () => void;
}) {
  return (
    <aside className="compare-tray" aria-label="Racquet comparison tray">
      <div>
        <span className="compare-count">{compareKeys.length}/{maxCompareFrames} selected</span>
        <div className="compare-tray-items">
          {compareKeys.map((modelKey) => (
            <button className="compare-chip" key={modelKey} onClick={() => onRemove(modelKey)} title="Remove from comparison">
              {modelNames?.[modelKey] ?? modelKey}<span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      </div>
      <div className="compare-tray-actions">
        <button className="compare-clear" onClick={onClear}>Clear</button>
        <button className="compare-open" disabled={compareKeys.length < 2} onClick={onOpen}>Compare racquets</button>
      </div>
    </aside>
  );
}

export function ComparisonDialog({ compareKeys, data, specs, refreshingModels, onPreviewImage, onClose }: {
  compareKeys: string[];
  data: Dashboard | null;
  specs: Record<string, RacquetSpec>;
  refreshingModels: Set<string>;
  onPreviewImage: (modelKey: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="compare-modal-backdrop" role="presentation" onMouseDown={closeOnBackdrop(onClose)}>
      <section className="compare-modal" role="dialog" aria-modal="true" aria-labelledby="compare-title">
        <div className="compare-modal-head">
          <div><p className="eyebrow">SIDE-BY-SIDE</p><h2 id="compare-title">Racquet comparison</h2></div>
          <button onClick={onClose} aria-label="Close comparison">×</button>
        </div>
        <p className="compare-note">{comparisonNote}</p>
        <div className="comparison-scroll">
          <table className="comparison-table" style={{ "--compare-columns": compareKeys.length } as React.CSSProperties}>
            <thead>
              <tr><th>Specification</th>{compareKeys.map((key) => <th key={key}><RacquetImage modelKey={key} spec={specs[key]} className="comparison-frame-thumb" width={82} height={108} alt={`${data?.modelNames[key] ?? key} racquet`} onPreview={onPreviewImage} /><strong>{data?.modelNames[key] ?? key}</strong><span>{modelBrand(key)}</span>{refreshingModels.has(key) && <small className="model-refresh-state"><i />Refreshing…</small>}</th>)}</tr>
            </thead>
            <tbody>
              {comparisonRows.map(([label, field]) => (
                <tr className={field === "pattern" ? "comparison-pattern-row" : ""} key={field}><th>{label}</th>{compareKeys.map((key) => <td key={key}><SpecValue field={field} spec={specs[key]} /></td>)}</tr>
              ))}
              <tr><th>Independent validation</th>{compareKeys.map((key) => { const validation = validationPresentation(data?.specValidation?.[key]); return <td key={key}><span className={`spec-validation ${validation.tone}`}>{validation.label}</span></td>; })}</tr>
              <tr><th>Specification source</th>{compareKeys.map((key) => {
                const spec = specs[key];
                return <td key={key}>{spec?.sourceUrl ? <a className="comparison-source" href={spec.sourceUrl} target="_blank" rel="noreferrer">{spec.source ?? "Manufacturer / retailer source"} ↗</a> : (spec?.source ?? "Catalogue fallback")}</td>;
              })}</tr>
              <tr><th>Best live price</th>{compareKeys.map((key) => {
                const best = (data?.offers ?? []).filter((offer) => offer.modelKey === key && offer.inStock && offer.currentPrice !== null).sort((a, b) => (a.currentPrice ?? Infinity) - (b.currentPrice ?? Infinity))[0];
                return <td key={key}><strong>{best?.currentPrice != null ? money.format(best.currentPrice) : "—"}</strong>{best && <small>{best.store}</small>}</td>;
              })}</tr>
            </tbody>
          </table>
        </div>
        {/* Phones show the note collapsed under the table so the table gets the screen. */}
        <details className="compare-note-mobile"><summary>About these specs</summary><p>{comparisonNote}</p></details>
      </section>
    </div>
  );
}
