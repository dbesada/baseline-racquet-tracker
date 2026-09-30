import assert from "node:assert/strict";
import test from "node:test";
import { modelFitTags, recommendModels, recommendStrings, stringFitTags } from "../app/ui/coach-recommender.js";

const racquets = [
  { key: "clash-100", name: "Wilson Clash 100", brand: "Wilson", head: "100 in²", weight: "295 g", pattern: "16 × 19", profile: "Comfort / spin", price: 279, store: "A", url: "#" },
  { key: "blade-v10", name: "Wilson Blade 98 v10", brand: "Wilson", head: "98 in²", weight: "305 g", pattern: "16 × 19", profile: "Control / feel", price: 289, store: "A", url: "#" },
  { key: "ultra-100", name: "Wilson Ultra 100", brand: "Wilson", head: "100 in²", weight: "300 g", pattern: "16 × 19", profile: "Easy power", price: 249, store: "A", url: "#" },
  { key: "pure-aero-98", name: "Babolat Pure Aero 98", brand: "Babolat", head: "98 in²", weight: "305 g", pattern: "16 × 20", profile: "Spin / precision", price: 299, store: "B", url: "#" },
  { key: "ezone-100", name: "Yonex EZONE 100", brand: "Yonex", head: "100 in²", weight: "300 g", pattern: "16 × 19", profile: "Power / control", price: 289, store: "C", url: "#" },
  { key: "vcore-98", name: "Yonex VCORE 98", brand: "Yonex", head: "98 in²", weight: "305 g", pattern: "16 × 19", profile: "Spin / control", price: 289, store: "C", url: "#" },
  { key: "speed-mp", name: "Head Speed MP", brand: "Head", head: "100 in²", weight: "300 g", pattern: "16 × 19", profile: "Balanced all-court versatility", price: 279, store: "D", url: "#" },
  { key: "boost-aero", name: "Babolat Boost Aero", brand: "Babolat", head: "102 in²", weight: "260 g", pattern: "16 × 19", profile: "Recreational easy power", price: 149, store: "B", url: "#" },
];

const strings = [
  { key: "multi-set", title: "Head Velocity MLT Set", brand: "Head", type: "Multifilament", gauges: ["16"], format: "Set", price: 18, store: "A", url: "#" },
  { key: "gut-set", title: "Babolat VS Touch Set", brand: "Babolat", type: "Natural gut", gauges: ["16"], format: "Set", price: 62, store: "B", url: "#" },
  { key: "poly-set", title: "Solinco Hyper-G Set", brand: "Solinco", type: "Polyester", gauges: ["17"], format: "Set", price: 17, store: "C", url: "#" },
  { key: "hybrid-half", title: "Wilson Duo Control Half Set", brand: "Wilson", type: "Hybrid", gauges: ["16L", "17"], format: "Half set", price: 16, store: "D", url: "#" },
  { key: "poly-half", title: "Luxilon ALU Power Half Set", brand: "Luxilon", type: "Polyester", gauges: ["17"], format: "Half set", price: 14, store: "E", url: "#" },
  { key: "multi-half", title: "Tecnifibre X-One Half Set", brand: "Tecnifibre", type: "Multifilament", gauges: ["16"], format: "Half set", price: 15, store: "F", url: "#" },
  { key: "poly-reel", title: "Yonex Poly Tour Pro Reel", brand: "Yonex", type: "Polyester", gauges: ["17"], format: "Reel", price: 180, store: "G", url: "#" },
  { key: "hybrid-reel", title: "Control Hybrid Reel", brand: "Gamma", type: "Hybrid", gauges: ["16L"], format: "Reel", price: 165, store: "H", url: "#" },
  { key: "multi-reel", title: "Comfort Multi Reel", brand: "Prince", type: "Multifilament", gauges: ["16"], format: "Reel", price: 150, store: "I", url: "#" },
  { key: "hybrid-a", title: "Babolat RPM Blast 17 + XCEL 16 Hybrid Set", brand: "Babolat", type: "Hybrid", gauges: ["16", "17"], format: "Set", price: 23, store: "J", url: "#" },
  { key: "hybrid-b", title: "Babolat XCEL 16 + RPM Blast 17 Hybrid Set", brand: "Babolat", type: "Hybrid", gauges: ["16", "17"], format: "Set", price: 24, store: "K", url: "#" },
];

test("racquet answers materially change rankings and honor a selected brand", () => {
  const base = { focus: "racquets", level: "intermediate", arm: "fine", budget: "any", brand: "any" };
  const topByPriority = Object.fromEntries(["comfort", "power", "spin", "control", "balanced"].map((priority) => [priority, recommendModels(racquets, { ...base, priority })[0].key]));
  assert.equal(new Set(Object.values(topByPriority)).size, 5, JSON.stringify(topByPriority));
  const wilson = recommendModels(racquets, { ...base, priority: "control", brand: "Wilson" });
  assert.equal(wilson.length, 3);
  assert.ok(wilson.every((model) => model.brand === "Wilson"));
  assert.equal(new Set(wilson.map((model) => model.key.split("-")[0])).size >= 2, true);
  assert.ok(modelFitTags(wilson[0], { ...base, priority: "control", brand: "Wilson" }).some((tag) => tag.includes("Wilson")));
});

test("string material and package choices produce different recommendations", () => {
  const base = { focus: "strings", level: "intermediate", arm: "fine", budget: "any", stringFormat: "any" };
  const comfort = recommendStrings(strings, { ...base, priority: "comfort" });
  const spin = recommendStrings(strings, { ...base, priority: "spin" });
  assert.notEqual(comfort[0].key, spin[0].key);
  assert.match(comfort[0].type, /Multifilament|Natural gut/);
  assert.match(spin[0].type, /Polyester|Hybrid/);

  for (const [preference, label] of [["set", "Set"], ["half-set", "Half set"], ["reel", "Reel"]]) {
    const picks = recommendStrings(strings, { ...base, priority: "balanced", stringFormat: preference });
    assert.ok(picks.every((item) => item.format === label), `${preference}: ${picks.map((item) => item.format)}`);
    assert.ok(stringFitTags(picks[0], { ...base, priority: "balanced", stringFormat: preference }).includes(label));
  }

  const setPicks = recommendStrings(strings, { ...base, priority: "balanced", stringFormat: "set" });
  assert.ok(!(setPicks.some((item) => item.key === "hybrid-a") && setPicks.some((item) => item.key === "hybrid-b")));
});
