"use client";

import { useState } from "react";
import { court, referenceTension, simulateShot } from "./play-ratings";

type Pattern = { mains: number; crosses: number };
type Setup = { pattern: Pattern; head: number; tension: number; speed: number };

const patternChoices: Array<{ value: string; label: string; pattern: Pattern }> = [
  { value: "16x18", label: "Very open, 16 × 18", pattern: { mains: 16, crosses: 18 } },
  { value: "16x19", label: "Open, 16 × 19", pattern: { mains: 16, crosses: 19 } },
  { value: "16x20", label: "Tighter, 16 × 20", pattern: { mains: 16, crosses: 20 } },
  { value: "18x20", label: "Dense, 18 × 20", pattern: { mains: 18, crosses: 20 } },
];
const patternKey = (pattern: Pattern) => `${pattern.mains}x${pattern.crosses}`;
const open = patternChoices[1].pattern;
const dense = patternChoices[3].pattern;

const presets: Array<{ label: string; setup: Setup }> = [
  { label: "Easy frame, relaxed swing", setup: { pattern: open, head: 105, tension: 52, speed: 85 } },
  { label: "All-round 100", setup: { pattern: open, head: 100, tension: 54, speed: 105 } },
  { label: "Control frame, fast swing", setup: { pattern: dense, head: 98, tension: 56, speed: 120 } },
  { label: "Easy frame, fast swing", setup: { pattern: open, head: 105, tension: 50, speed: 125 } },
];

// The drawing: 600 units of court length, heights stretched so they show.
const left = 50;
const ground = 176;
const perMetre = 540 / court.length;
const perMetreUp = 44;
const pathData = (path: number[][]) => path.map(([x, y], index) => `${index ? "L" : "M"}${(left + x * perMetre).toFixed(1)} ${(ground - y * perMetreUp).toFixed(1)}`).join("");

function resultText(shot: ReturnType<typeof simulateShot>) {
  if (shot.outcome === "net") return "Into the net";
  if (shot.outcome === "long") return `Long by ${(shot.landing - court.length).toFixed(1)} m`;
  const inside = court.length - shot.landing;
  return shot.landing < court.net + 6.4 ? "In, but short" : inside < 1.5 ? `Deep, ${inside.toFixed(1)} m inside` : `In, ${inside.toFixed(1)} m inside`;
}

// A side view of the court: the racquet's string pattern, head size and
// tension set how high the ball leaves the strings; swing speed does the rest.
// Opened from a racquet it starts on that racquet's own specs.
export function LaunchSimulator({ pattern, head, racquetName }: { pattern?: Pattern | null; head?: number; racquetName?: string }) {
  const own: Setup | null = pattern && head ? { pattern, head: Math.min(115, Math.max(93, Math.round(head))), tension: referenceTension, speed: 108 } : null;
  const [setup, setSetup] = useState<Setup>(own ?? presets[1].setup);
  const change = (part: Partial<Setup>) => setSetup((current) => ({ ...current, ...part }));

  const shot = simulateShot({ pattern: setup.pattern, head: setup.head, tension: setup.tension, speedKmh: setup.speed });
  // The same swing with the opposite kind of pattern, for comparison.
  const other = setup.pattern.mains >= 18 ? open : dense;
  const otherShot = simulateShot({ pattern: other, head: setup.head, tension: setup.tension, speedKmh: setup.speed });
  const good = shot.outcome === "in";
  const clearance = shot.heightAtNet === null ? null : Math.round((shot.heightAtNet - court.netHeight) * 100);
  const choices = patternChoices.some((choice) => choice.value === patternKey(setup.pattern)) ? patternChoices
    : [...patternChoices, { value: patternKey(setup.pattern), label: `${setup.pattern.mains} × ${setup.pattern.crosses}`, pattern: setup.pattern }];
  const landingX = Math.min(left + shot.landing * perMetre, 630);

  return <div className="launch-sim">
    <div className="launch-sim-presets">
      {own && <button type="button" onClick={() => setSetup(own)}>{racquetName ?? "This racquet"}</button>}
      {presets.map((preset) => <button type="button" key={preset.label} onClick={() => setSetup(preset.setup)}>{preset.label}</button>)}
    </div>
    <svg viewBox="0 0 640 208" role="img" aria-label={`Ball flight from the baseline: launch angle ${shot.angle.toFixed(1)} degrees, ${resultText(shot).toLowerCase()}.`}>
      <line x1="16" y1={ground} x2="624" y2={ground} className="launch-sim-ground" />
      <rect x={left} y={ground} width="540" height="5" className="launch-sim-court" />
      <line x1={left + court.net * perMetre} y1={ground} x2={left + court.net * perMetre} y2={ground - court.netHeight * perMetreUp} className="launch-sim-net" />
      <text x="16" y="200">Your baseline</text>
      <text x={left + court.net * perMetre} y="200" textAnchor="middle">Net</text>
      <text x="624" y="200" textAnchor="end">Far baseline</text>
      <path d={pathData(otherShot.path)} className="launch-sim-other" />
      <path d={pathData(shot.path)} className={`launch-sim-path ${good ? "" : "miss"}`} />
      <circle cx={landingX} cy={shot.outcome === "net" ? ground - Math.max(shot.heightAtNet ?? 0, 0) * perMetreUp : ground} r="5" className={`launch-sim-ball ${good ? "" : "miss"}`} />
      <line x1="20" y1="14" x2="42" y2="14" className={`launch-sim-path ${good ? "" : "miss"}`} />
      <text x="48" y="18">Your setup</text>
      <line x1="150" y1="14" x2="172" y2="14" className="launch-sim-other" />
      <text x="178" y="18">Same swing with {other.mains} × {other.crosses}</text>
    </svg>
    <div className="launch-sim-results" aria-live="polite">
      <div><span>Launch angle</span><strong>{shot.angle.toFixed(1)}°</strong></div>
      <div><span>Net clearance</span><strong>{clearance === null ? "—" : clearance < 0 ? `${-clearance} cm too low` : `${clearance} cm`}</strong></div>
      <div><span>Result</span><strong className={good ? "good" : "miss"}>{resultText(shot)}</strong></div>
    </div>
    <div className="launch-sim-controls">
      <label><span>String pattern</span><select value={patternKey(setup.pattern)} onChange={(event) => change({ pattern: choices.find((choice) => choice.value === event.target.value)?.pattern ?? open })}>{choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select></label>
      <label><span>Head size</span><input type="range" min="93" max="115" step="1" value={setup.head} onChange={(event) => change({ head: Number(event.target.value) })} /><b>{setup.head} in²</b></label>
      <label><span>String tension</span><input type="range" min="44" max="62" step="1" value={setup.tension} onChange={(event) => change({ tension: Number(event.target.value) })} /><b>{setup.tension} lb</b></label>
      <label><span>Swing speed</span><input type="range" min="70" max="135" step="1" value={setup.speed} onChange={(event) => change({ speed: Number(event.target.value) })} /><b>{setup.speed} km/h</b></label>
    </div>
    <p className="launch-sim-note">A simplified model to show the idea, not a measurement of any racquet. Heights are stretched so the differences show, and your own swing path and topspin change the result.</p>
  </div>;
}
