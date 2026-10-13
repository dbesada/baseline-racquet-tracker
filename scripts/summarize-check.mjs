import { readFile } from "node:fs/promises";

// Prints a Markdown summary of one price check (which sources answered and
// how many listings each returned), for a GitHub Actions job summary.
// Usage: node scripts/summarize-check.mjs .data/baseline-monitor.json

const state = JSON.parse(await readFile(process.argv[2] ?? ".data/baseline-monitor.json", "utf8"));
const groups = [
  ["Racquet stores", state.retailerResults],
  ["Strings", state.stringSourceResults],
  ["Accessories", state.accessorySourceResults],
  ["Balls", state.ballSourceResults],
  ["Used", state.usedSourceResults],
];

const lines = [`## Price check ${state.checkedAt}`, ""];
const all = groups.flatMap(([, results]) => results ?? []).filter((result) => result.configured !== false);
lines.push(`**${all.filter((result) => result.ok).length} of ${all.length} sources answered** · ${Object.keys(state.offers ?? {}).length} racquet listings`, "");
for (const [title, results] of groups) {
  if (!results?.length) continue;
  lines.push(`### ${title}`, "", "| Source | Answered | Listings | Seconds | Error |", "|---|---|---|---|---|");
  for (const result of results) {
    if (result.configured === false) continue;
    const error = String(result.error ?? "").replace(/\|/g, "/").slice(0, 120);
    lines.push(`| ${result.store ?? result.source ?? result.name ?? "?"} | ${result.ok ? "yes" : "**no**"} | ${result.offers ?? result.count ?? ""} | ${Math.round((result.durationMs ?? 0) / 1000)} | ${error} |`);
  }
  lines.push("");
}
console.log(lines.join("\n"));
