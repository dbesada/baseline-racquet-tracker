-- D1 tables for Baseline on Cloudflare. Safe to run again (IF NOT EXISTS).

-- Every listing a visitor can open through /go/<id>, written by the GitHub
-- price check. The URL is already the affiliate link when one applies.
-- Rows not seen for 7 days are removed, like the NAS relay's memory of offers.
CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  store TEXT,
  network TEXT,
  kind TEXT,
  model TEXT,
  seen_at INTEGER NOT NULL
);

-- Lowest in-stock price per racquet, for price-alert sign-ups.
CREATE TABLE IF NOT EXISTS model_prices (
  model_key TEXT PRIMARY KEY,
  price REAL,
  store TEXT
);

-- Buy clicks from public visitors (no IP address, user agent or cookie).
CREATE TABLE IF NOT EXISTS clicks (
  ts TEXT NOT NULL,
  offer_id TEXT,
  retailer TEXT,
  market TEXT,
  network TEXT,
  kind TEXT,
  model TEXT
);
CREATE INDEX IF NOT EXISTS clicks_ts ON clicks (ts);

-- Daily aggregate counts. detail '' is the event's own count.
CREATE TABLE IF NOT EXISTS analytics (
  day TEXT NOT NULL,
  event TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, event, detail)
);

-- Lowest in-stock price per racquet per day (Toronto date), kept 400 days.
CREATE TABLE IF NOT EXISTS price_history (
  model_key TEXT NOT NULL,
  day TEXT NOT NULL,
  low REAL NOT NULL,
  store TEXT,
  PRIMARY KEY (model_key, day)
);

-- Server-rendered racquet pages (/racquets/<slug>), rebuilt by every publish.
CREATE TABLE IF NOT EXISTS racquet_pages (
  slug TEXT PRIMARY KEY,
  model_key TEXT NOT NULL,
  html TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Price-alert subscriptions: the browser's push endpoint and keys with its
-- alerts, as JSON (same shape as the NAS relay's file).
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
