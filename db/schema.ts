import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const offers = sqliteTable("offers", {
  id: text("id").primaryKey(),
  modelKey: text("model_key").notNull(),
  store: text("store").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  currentPrice: real("current_price"),
  previousPrice: real("previous_price"),
  compareAtPrice: real("compare_at_price"),
  inStock: integer("in_stock", { mode: "boolean" }).notNull(),
  gripSizes: text("grip_sizes").notNull().default("[]"),
  lastChecked: text("last_checked").notNull(),
});

export const priceHistory = sqliteTable("price_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  offerId: text("offer_id").notNull(),
  modelKey: text("model_key").notNull(),
  price: real("price").notNull(),
  checkedAt: text("checked_at").notNull(),
});

export const targets = sqliteTable("targets", {
  modelKey: text("model_key").primaryKey(),
  targetPrice: real("target_price").notNull(),
});

export const checks = sqliteTable("checks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  checkedAt: text("checked_at").notNull(),
  storesChecked: integer("stores_checked").notNull(),
  offersFound: integer("offers_found").notNull(),
  failures: integer("failures").notNull(),
});
