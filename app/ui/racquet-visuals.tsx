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

// A racquet photo that opens the larger preview when clicked.
export function RacquetImage({ modelKey, spec, className, width, height, alt, sizes, onPreview }: {
  modelKey: string;
  spec?: RacquetSpec;
  className: string;
  width: number;
  height: number;
  alt: string;
  sizes?: string;
  onPreview: (modelKey: string) => void;
}) {
  const src = modelImage(modelKey, spec?.imageUrl);
  const pending = src.includes("racquet-photo-pending.svg");
  return <button type="button" className={`${className} image-preview-trigger`} onClick={() => onPreview(modelKey)} aria-label={`View larger photo of ${alt}`} title={pending ? "Photo is being verified" : `View ${alt} photo`}>
    <Image src={src} alt={alt} width={width} height={height} sizes={sizes} unoptimized />
    <span className="image-preview-hint">{pending ? "Photo pending" : "View photo"}</span>
  </button>;
}
