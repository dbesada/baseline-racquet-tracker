"use client";

import { useEffect, useState } from "react";
import { historyPath, historySummary } from "../lib/price-history";
import { money } from "./baseline-catalogue";

type Point = { day: string; low: number; store?: string };

const shortDay = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });

// A racquet's daily lowest Canadian price (from /api/history on Cloudflare),
// with the 30-day low and whether today's price is a good one. Shows nothing
// where the history route does not exist or there is too little history.
export function PriceHistory({ modelKey, currentPrice }: { modelKey: string; currentPrice: number | null }) {
  const [points, setPoints] = useState<Point[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/history?model=${encodeURIComponent(modelKey)}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() as Promise<{ points?: Point[] }> : null))
      .then((body) => { if (active) setPoints(Array.isArray(body?.points) ? body.points : []); })
      .catch(() => { if (active) setPoints([]); });
    return () => { active = false; };
  }, [modelKey]);

  if (!points || points.length < 2) return null;
  const summary = historySummary(points, currentPrice ?? undefined);
  const lows = points.map((point) => point.low);
  return <section className="price-history" aria-label="Price history">
    <div className="price-history-head">
      <strong>Price history</strong>
      {summary?.isLowest30 && <span className="price-history-good">Lowest price in 30 days</span>}
      {summary?.isLowestSinceStart && <span className="price-history-good">Lowest price since {shortDay(summary.since)}</span>}
      {summary?.aboveUsual && <span className="price-history-high">Higher than usual</span>}
    </div>
    <svg viewBox="0 0 600 120" role="img" aria-label={`Lowest price per day from ${shortDay(points[0].day)} to ${shortDay(points.at(-1)!.day)}`}>
      <path d={historyPath(points, 600, 120)} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
    <div className="price-history-axis">
      <span>{shortDay(points[0].day)}</span>
      <span>Low {money.format(Math.min(...lows))} · High {money.format(Math.max(...lows))}</span>
      <span>{shortDay(points.at(-1)!.day)}</span>
    </div>
    {summary && <p>{summary.coversMonth ? "30-day low" : "Lowest so far"} {money.format(summary.low30)} on {shortDay(summary.low30Day)}{summary.aboveUsual ? `; usually about ${money.format(summary.median30)}` : ""}. Tracked since {shortDay(summary.since)}.</p>}
  </section>;
}
