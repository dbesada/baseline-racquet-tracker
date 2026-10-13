import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { modelNames } from "../app/lib/racquet-catalogue.js";
import { createPriceAlerts } from "./price-alerts.mjs";

// After a price check on GitHub: sends price alerts to the subscriptions kept
// in Cloudflare D1, then writes the changes (last prices, met targets, gone
// subscriptions) as SQL for the workflow to apply. A row the visitor changed
// while this ran (updated_at moved on) is left as the visitor set it.
//
// Usage: node scripts/send-alerts-cloudflare.mjs <d1 export.json> <state.json> <out.sql>
// Needs BASELINE_VAPID_KEYS: {"publicKey":"…","privateKey":"…"} (a GitHub secret).

const [exportPath, statePath, outPath] = process.argv.slice(2);
const exported = JSON.parse(await readFile(exportPath, "utf8"));
const rows = (Array.isArray(exported) ? exported[0]?.results : exported?.results) ?? [];
const state = JSON.parse(await readFile(statePath, "utf8"));

const folder = await mkdtemp(join(tmpdir(), "baseline-alerts-"));
const storePath = join(folder, "alerts.json");
const keysPath = join(folder, "keys.json");
await writeFile(storePath, JSON.stringify({ version: 1, subscriptions: Object.fromEntries(rows.map((row) => [row.id, JSON.parse(row.data)])) }));
await writeFile(keysPath, process.env.BASELINE_VAPID_KEYS ?? "", { mode: 0o600 });

const alerts = createPriceAlerts({ storePath, keysPath, subject: process.env.BASELINE_PUSH_SUBJECT ?? "https://baseline-beta.besada.net" });
const sent = await alerts.notifyAfterCheck(state, modelNames);
const after = JSON.parse(await readFile(storePath, "utf8")).subscriptions;

const sql = (value) => `'${String(value).replace(/'/g, "''")}'`;
const statements = [];
for (const row of rows) {
  const next = after[row.id];
  if (!next) statements.push(`DELETE FROM push_subscriptions WHERE id = ${sql(row.id)} AND updated_at = ${Number(row.updated_at)};`);
  else if (JSON.stringify(next) !== JSON.stringify(JSON.parse(row.data))) {
    statements.push(`UPDATE push_subscriptions SET data = ${sql(JSON.stringify(next))} WHERE id = ${sql(row.id)} AND updated_at = ${Number(row.updated_at)};`);
  }
}
await writeFile(outPath, statements.length ? `${statements.join("\n")}\n` : "SELECT 1;\n");
console.log(`Price alerts: ${rows.length} subscriptions, ${sent} sent, ${statements.length} rows to update.`);
