"use client";

import Image from "next/image";
import type { RacquetSpec } from "./baseline-types";
import { modelImage, patternPresentation } from "./baseline-catalogue";

export function PatternBadge({ pattern, compact = false }: { pattern?: string; compact?: boolean }) {
  const presentation = patternPresentation(pattern);
  if (!presentation) return null;
  return <span className={`pattern-badge pattern-${presentation.tone} ${compact ? "compact" : ""}`} title={`String pattern: ${presentation.label}`}>
    <strong>{presentation.label}</strong><small>{presentation.detail}</small>
  </span>;
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
