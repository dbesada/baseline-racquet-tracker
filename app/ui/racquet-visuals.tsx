"use client";

import Image from "next/image";
import type { RacquetSpec } from "./baseline-types";
import { modelImage, patternPresentation, standardizedSpecDisplay } from "./baseline-catalogue";
import { playerFit } from "./player-fit";
import { TermTip } from "./TermTip";

export function PatternBadge({ pattern, compact = false }: { pattern?: string; compact?: boolean }) {
  const presentation = patternPresentation(pattern);
  if (!presentation) return null;
  return <TermTip term="pattern" className="pattern-tip">
    <span className={`pattern-badge pattern-${presentation.tone} ${compact ? "compact" : ""}`}><strong>{presentation.label}</strong><small>{presentation.detail}</small></span>
  </TermTip>;
}

// "Good for beginners · big sweet spot, light to swing", from head size and
// weight. Shows nothing when either is unknown.
export function PlayerFit({ spec }: { spec?: RacquetSpec }) {
  const fit = playerFit(spec);
  if (!fit) return null;
  return <TermTip term="fit" className={`player-fit ${fit.level}`}><strong>{fit.label}</strong> <span>{fit.reasons.join(", ")}</span></TermTip>;
}

// A racquet photo. On cards it opens the racquet's details pop-up
// (action "details"); inside that pop-up it opens the larger photo.
export function RacquetImage({ modelKey, spec, className, width, height, alt, sizes, onPreview, action = "photo" }: {
  modelKey: string;
  spec?: RacquetSpec;
  className: string;
  width: number;
  height: number;
  alt: string;
  sizes?: string;
  onPreview: (modelKey: string) => void;
  action?: "photo" | "details";
}) {
  const src = modelImage(modelKey, spec?.imageUrl);
  const pending = src.includes("racquet-photo-pending.svg");
  const details = action === "details";
  return <button type="button" className={`${className} image-preview-trigger`} onClick={() => onPreview(modelKey)} aria-label={details ? `View specs and prices for ${alt}` : `View larger photo of ${alt}`} title={details ? "Specs & prices" : pending ? "Photo is being verified" : `View ${alt} photo`}>
    <Image src={src} alt={alt} width={width} height={height} sizes={sizes} unoptimized />
    <span className="image-preview-hint">{details ? "Specs & prices" : pending ? "Photo pending" : "View photo"}</span>
  </button>;
}

// A racquet name that opens its details pop-up.
export function RacquetName({ modelKey, name, onOpen }: { modelKey: string; name: string; onOpen: (modelKey: string) => void }) {
  return <button type="button" className="racquet-name-button" onClick={() => onOpen(modelKey)} title="Specs & prices">{name}</button>;
}

// The short "100 in² · 300 g · 69 RA" line on a card. Each value explains
// itself when tapped.
export function CardSpecs({ spec }: { spec: RacquetSpec }) {
  const parts = ([["head", standardizedSpecDisplay("head", spec.head, false)], ["weight", standardizedSpecDisplay("weight", spec.weight, false)], ["stiffness", standardizedSpecDisplay("stiffness", spec.stiffness, false)]] as const)
    .filter(([, value]) => value);
  if (!parts.length) return null;
  return <span className="card-specs">{parts.map(([term, value], index) => <span key={term}>{index > 0 && " · "}<TermTip term={term}>{value}</TermTip></span>)}</span>;
}
