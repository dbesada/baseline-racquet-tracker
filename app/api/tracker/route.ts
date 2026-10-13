import { env } from "cloudflare:workers";
import { defaultTargets, modelNames } from "../../lib/racquet-catalogue.js";
import { isOwnKey, readJsonObject } from "../../lib/request-body.js";
import { planSettingsRestore } from "../../lib/settings-restore.js";
import { feeds, defaultUsedTargets, topRatedModelKeys, newReleaseModelKeys, preorderModelLabels, defaultModelOrder, shortlistSlotCount, featuredBrands, featuredSlotCount, defaultBrandPicks } from "../../lib/tracker-catalogue.js";

export const dynamic = "force-dynamic";

type D1Result<T = Record<string, unknown>> = { results?: T[] };

// The beta hostname intentionally has a read-only API.  Its visitors keep
// personal choices in their own browser; only the Access-protected hostname
// may change the shared tracker, catalogue, or refresh schedule.
const publicPreviewHosts = new Set(["baseline-beta.besada.net"]);

function isPublicPreview(request: Request) {
  if (request.headers.get("x-baseline-public-preview") === "true") return true;
  // The protected hostname carries Cloudflare Access' signed assertion. A
  // request arriving through Cloudflare without that assertion is public-beta
  // traffic, even when a tunnel proxy has rewritten the origin Host header.
  if (request.headers.get("cf-ray") && !request.headers.get("cf-access-jwt-assertion")) return true;
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = (forwardedHost ?? request.headers.get("host") ?? "").split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
  return publicPreviewHosts.has(host);
}

function publicPreviewDenied() {
  return Response.json({ error: "This action is available in the protected Baseline admin app." }, { status: 403 });
}

type FeaturedBrand = "Wilson" | "Yonex" | "Babolat" | "Head" | "Tecnifibre" | "Dunlop" | "Prince" | "Volkl";

function belongsToBrand(modelKey: string, brand: FeaturedBrand) {
  return isOwnKey(modelNames, modelKey) && modelNames[modelKey].startsWith(`${brand} `);
}

function db() {
  return env.DB as D1Database;
}

type GripSize = "L0" | "L1" | "L2" | "L3" | "L4" | "L5";
const validGripSizes = new Set<GripSize>(["L0", "L1", "L2", "L3", "L4", "L5"]);

async function getGripSize(): Promise<GripSize> {
  const row = await db().prepare("SELECT value FROM tracker_preferences WHERE key = 'grip_size'").first<{ value: string }>();
  return validGripSizes.has(row?.value as GripSize) ? row!.value as GripSize : "L3";
}

async function ensureSchema() {
  const database = db();
  await database.batch([
    database.prepare(`CREATE TABLE IF NOT EXISTS targets (
      model_key TEXT PRIMARY KEY, target_price REAL NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS used_targets (
      model_key TEXT PRIMARY KEY, target_price REAL NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS retailer_settings (
      retailer_key TEXT PRIMARY KEY, retailer_name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS settings_migrations (
      migration_key TEXT PRIMARY KEY, applied_at TEXT NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS tracker_preferences (
      key TEXT PRIMARY KEY, value TEXT NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS shortlist_slots (
      slot INTEGER PRIMARY KEY, model_key TEXT NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS brand_featured_slots (
      brand TEXT NOT NULL, slot INTEGER NOT NULL, model_key TEXT NOT NULL,
      PRIMARY KEY (brand, slot)
    )`),
  ]);
  await database.prepare("INSERT OR IGNORE INTO tracker_preferences (key, value) VALUES ('grip_size', 'L3')").run();

  await database.batch(
    Object.entries(defaultTargets).map(([key, value]) =>
      database.prepare("INSERT OR IGNORE INTO targets (model_key, target_price) VALUES (?, ?)").bind(key, value),
    ),
  );
  await database.batch(
    Object.entries(defaultUsedTargets).map(([key, value]) =>
      database.prepare("INSERT OR IGNORE INTO used_targets (model_key, target_price) VALUES (?, ?)").bind(key, value),
    ),
  );
  await database.batch(defaultModelOrder.map((modelKey, slot) => database.prepare(
    "INSERT OR IGNORE INTO shortlist_slots (slot, model_key) VALUES (?, ?)",
  ).bind(slot, modelKey)));
  await database.batch(featuredBrands.flatMap((brand) => defaultBrandPicks[brand].map((modelKey, slot) => database.prepare(
    "INSERT OR IGNORE INTO brand_featured_slots (brand, slot, model_key) VALUES (?, ?, ?)",
  ).bind(brand, slot, modelKey))));
  await database.batch(
    feeds.map((feed) => database.prepare(
      "INSERT OR IGNORE INTO retailer_settings (retailer_key, retailer_name, enabled) VALUES (?, ?, ?)",
    ).bind(feed.key, feed.name, feed.kind === "manual" ? 0 : 1)),
  );
  const catalogMigration = await database.prepare(
    "SELECT migration_key FROM settings_migrations WHERE migration_key = ?",
  ).bind("automate-public-catalogs-v1").first();
  if (!catalogMigration) {
    const automatedKeys = feeds.filter((feed) => feed.kind !== "manual").map((feed) => feed.key);
    await database.batch(automatedKeys.map((key) => database.prepare(
      "UPDATE retailer_settings SET enabled = 1 WHERE retailer_key = ?",
    ).bind(key)));
    await database.prepare(
      "INSERT INTO settings_migrations (migration_key, applied_at) VALUES (?, ?)",
    ).bind("automate-public-catalogs-v1", new Date().toISOString()).run();
  }
  // Prices live in the monitor's state file (.data/baseline-monitor.json), which
  // the relay serves. Nothing has written these tables since the API stopped
  // reading retailer pages, so an old database only holds stale prices.
  const priceTablesMigration = await database.prepare(
    "SELECT migration_key FROM settings_migrations WHERE migration_key = ?",
  ).bind("drop-unused-price-tables-v1").first();
  if (!priceTablesMigration) {
    await database.batch([
      database.prepare("DROP INDEX IF EXISTS price_history_model_idx"),
      ...["offers", "price_history", "checks", "used_offers"].map((table) => database.prepare(`DROP TABLE IF EXISTS ${table}`)),
      database.prepare("INSERT INTO settings_migrations (migration_key, applied_at) VALUES (?, ?)")
        .bind("drop-unused-price-tables-v1", new Date().toISOString()),
    ]);
  }
  // A database kept across releases can hold rows for models or retailers that
  // have since left the catalogue.
  const modelKeys = JSON.stringify(Object.keys(defaultTargets));
  await database.batch([
    database.prepare("DELETE FROM targets WHERE model_key NOT IN (SELECT value FROM json_each(?))").bind(modelKeys),
    database.prepare("DELETE FROM used_targets WHERE model_key NOT IN (SELECT value FROM json_each(?))").bind(modelKeys),
    database.prepare("DELETE FROM retailer_settings WHERE retailer_key NOT IN (SELECT value FROM json_each(?))")
      .bind(JSON.stringify(feeds.map((feed) => feed.key))),
  ]);
}

async function getRetailerSettings() {
  await ensureSchema();
  const result = await db().prepare(
    "SELECT retailer_key AS key, retailer_name AS name, enabled FROM retailer_settings ORDER BY retailer_name",
  ).all();
  return ((result as D1Result<Record<string, unknown>>).results ?? []).map((row) => ({
    ...row,
    enabled: Boolean(row.enabled),
    kind: feeds.find((feed) => feed.key === row.key)?.kind ?? "shopify",
    url: feeds.find((feed) => feed.key === row.key)?.url ?? "#",
  }));
}

async function getDashboard(publicPreview = false) {
  await ensureSchema();
  const database = db();
  const gripSize = await getGripSize();
  const [targetsResult, usedTargetsResult, retailerSettings, shortlistResult, brandFeaturedResult] = await Promise.all([
    database.prepare("SELECT model_key AS modelKey, target_price AS targetPrice FROM targets").all(),
    database.prepare("SELECT model_key AS modelKey, target_price AS targetPrice FROM used_targets").all(),
    getRetailerSettings(),
    database.prepare("SELECT slot, model_key AS modelKey FROM shortlist_slots ORDER BY slot").all(),
    database.prepare("SELECT brand, slot, model_key AS modelKey FROM brand_featured_slots ORDER BY brand, slot").all(),
  ]);

  const targetMap = Object.fromEntries(
    ((targetsResult as D1Result<{ modelKey: string; targetPrice: number }>).results ?? [])
      .map((row) => [row.modelKey, row.targetPrice]),
  );
  const usedTargetMap = Object.fromEntries(
    ((usedTargetsResult as D1Result<{ modelKey: string; targetPrice: number }>).results ?? [])
      .map((row) => [row.modelKey, row.targetPrice]),
  );
  const shortlist = ((shortlistResult as D1Result<{ slot: number; modelKey: string }>).results ?? [])
    .sort((a, b) => a.slot - b.slot).map((row) => row.modelKey);
  const brandRows = (brandFeaturedResult as D1Result<{ brand: FeaturedBrand; slot: number; modelKey: string }>).results ?? [];
  const brandPicks = Object.fromEntries(featuredBrands.map((brand) => {
    const picks = brandRows.filter((row) => row.brand === brand).sort((a, b) => a.slot - b.slot).map((row) => row.modelKey);
    return [brand, picks.length === featuredSlotCount ? picks : defaultBrandPicks[brand]];
  }));

  // Prices, history and check results come from the price monitor; the relay
  // fills them in from its state file.
  return Response.json({
    publicPreview,
    offers: [],
    usedOffers: [],
    stringOffers: [],
    stringSourceResults: [],
    accessoryOffers: [],
    accessorySourceResults: [],
    ballOffers: [],
    ballSourceResults: [],
    saleOffers: [],
    targets: targetMap,
    usedTargets: usedTargetMap,
    lastCheck: null,
    dropsLast24Hours: 0,
    history: [],
    modelNames,
    modelOptions: Object.entries(modelNames).map(([key, name]) => ({
      key,
      name,
      topRated: topRatedModelKeys.has(key),
      releaseStatus: preorderModelLabels[key] ? "preorder" : newReleaseModelKeys.has(key) ? "new" : "catalogue",
      releaseLabel: preorderModelLabels[key] ?? (newReleaseModelKeys.has(key) ? "New 2026" : null),
    })),
    modelOrder: shortlist.length ? shortlist : defaultModelOrder,
    brandPicks,
    gripSize,
    retailers: retailerSettings,
    stores: retailerSettings.filter((retailer) => retailer.enabled && retailer.kind !== "manual").map((retailer) => retailer.name),
  });
}

export async function GET(request: Request) {
  return getDashboard(isPublicPreview(request));
}

export async function POST(request: Request) {
  if (isPublicPreview(request)) return publicPreviewDenied();
  // Price checks (check, models, model) run in the price monitor,
  // scripts/check-prices.mjs. The relay starts it and answers these requests
  // itself, so they only reach this route under `npm run dev`, which has no relay.
  return Response.json({ error: "Price checks run through the Baseline relay, which `npm run dev` does not start." }, { status: 501 });
}

export async function PATCH(request: Request) {
  if (isPublicPreview(request)) return publicPreviewDenied();
  await ensureSchema();
  const body = await readJsonObject(request) as { modelKey?: string; targetPrice?: number; market?: "new" | "used"; retailerKey?: string; enabled?: boolean; slot?: number; selectedModelKey?: string; featuredBrand?: FeaturedBrand; featuredSlot?: number; gripSize?: GripSize; restoreSettings?: unknown } | null;
  if (!body) return Response.json({ error: "Invalid request body" }, { status: 400 });
  if (body.restoreSettings !== undefined) return restoreSettings(body.restoreSettings);
  if (body.gripSize) {
    if (!validGripSizes.has(body.gripSize)) return Response.json({ error: "Invalid grip size" }, { status: 400 });
    await db().prepare("INSERT INTO tracker_preferences (key, value) VALUES ('grip_size', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .bind(body.gripSize).run();
    return getDashboard();
  }
  if (body.retailerKey) {
    if (!feeds.some((feed) => feed.key === body.retailerKey) || typeof body.enabled !== "boolean") {
      return Response.json({ error: "Invalid retailer setting" }, { status: 400 });
    }
    await db().prepare("UPDATE retailer_settings SET enabled = ? WHERE retailer_key = ?")
      .bind(body.enabled ? 1 : 0, body.retailerKey).run();
    return getDashboard();
  }
  if (Number.isInteger(body.slot) && body.selectedModelKey) {
    if (body.slot! < 0 || body.slot! >= shortlistSlotCount || !isOwnKey(modelNames, body.selectedModelKey)) {
      return Response.json({ error: "Invalid shortlist frame" }, { status: 400 });
    }
    const duplicate = await db().prepare("SELECT slot FROM shortlist_slots WHERE model_key = ? AND slot <> ?")
      .bind(body.selectedModelKey, body.slot).first();
    if (duplicate) return Response.json({ error: "That frame is already on your shortlist" }, { status: 409 });
    await db().prepare("UPDATE shortlist_slots SET model_key = ? WHERE slot = ?")
      .bind(body.selectedModelKey, body.slot).run();
    return getDashboard();
  }
  if (body.featuredBrand && Number.isInteger(body.featuredSlot) && body.selectedModelKey) {
    if (!featuredBrands.includes(body.featuredBrand) || body.featuredSlot! < 0 || body.featuredSlot! >= featuredSlotCount || !belongsToBrand(body.selectedModelKey, body.featuredBrand)) {
      return Response.json({ error: "Invalid featured brand frame" }, { status: 400 });
    }
    const duplicate = await db().prepare("SELECT slot FROM brand_featured_slots WHERE brand = ? AND model_key = ? AND slot <> ?")
      .bind(body.featuredBrand, body.selectedModelKey, body.featuredSlot).first();
    if (duplicate) return Response.json({ error: "That frame is already featured for this brand" }, { status: 409 });
    await db().prepare("UPDATE brand_featured_slots SET model_key = ? WHERE brand = ? AND slot = ?")
      .bind(body.selectedModelKey, body.featuredBrand, body.featuredSlot).run();
    return getDashboard();
  }
  if (!body.modelKey || !isOwnKey(defaultTargets, body.modelKey) || !Number.isFinite(body.targetPrice) || Number(body.targetPrice) < 1) {
    return Response.json({ error: "Invalid target" }, { status: 400 });
  }
  const targetTable = body.market === "used" ? "used_targets" : "targets";
  await db().prepare(`UPDATE ${targetTable} SET target_price = ? WHERE model_key = ?`)
    .bind(Number(body.targetPrice), body.modelKey).run();
  return getDashboard();
}

// Stores the relay's saved settings file in the database in one batch, so a
// database created fresh (or one that missed a change) matches what the owner
// saved. Values the API would refuse are skipped and keep their current value.
async function restoreSettings(settings: unknown) {
  const plan = planSettingsRestore(settings, {
    gripSizes: validGripSizes as Set<string>,
    retailerKeys: new Set(feeds.map((feed) => feed.key)),
    targetKeys: new Set(Object.keys(defaultTargets)),
    modelKeys: new Set(Object.keys(modelNames)),
    shortlistSlotCount,
    featuredBrands,
    featuredSlotCount,
    belongsToBrand: (modelKey: string, brand: string) => belongsToBrand(modelKey, brand as FeaturedBrand),
  });
  const database = db();
  const statements = [
    ...(plan.gripSize ? [database.prepare("INSERT INTO tracker_preferences (key, value) VALUES ('grip_size', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(plan.gripSize)] : []),
    ...plan.retailers.map(([key, enabled]) => database.prepare("UPDATE retailer_settings SET enabled = ? WHERE retailer_key = ?").bind(enabled ? 1 : 0, key)),
    ...plan.targets.map(([modelKey, price]) => database.prepare("UPDATE targets SET target_price = ? WHERE model_key = ?").bind(price, modelKey)),
    ...plan.usedTargets.map(([modelKey, price]) => database.prepare("UPDATE used_targets SET target_price = ? WHERE model_key = ?").bind(price, modelKey)),
    ...(plan.modelOrder ?? []).map((modelKey, slot) => database.prepare("UPDATE shortlist_slots SET model_key = ? WHERE slot = ?").bind(modelKey, slot)),
    ...plan.brandPicks.flatMap(([brand, picks]) => picks.map((modelKey, slot) => database.prepare("UPDATE brand_featured_slots SET model_key = ? WHERE brand = ? AND slot = ?").bind(modelKey, brand, slot))),
  ];
  if (statements.length) await database.batch(statements);
  return getDashboard();
}
