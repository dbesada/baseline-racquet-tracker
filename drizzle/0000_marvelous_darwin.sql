CREATE TABLE `checks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`checked_at` text NOT NULL,
	`stores_checked` integer NOT NULL,
	`offers_found` integer NOT NULL,
	`failures` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `offers` (
	`id` text PRIMARY KEY NOT NULL,
	`model_key` text NOT NULL,
	`store` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`current_price` real,
	`previous_price` real,
	`compare_at_price` real,
	`in_stock` integer NOT NULL,
	`grip_sizes` text DEFAULT '[]' NOT NULL,
	`last_checked` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `price_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`offer_id` text NOT NULL,
	`model_key` text NOT NULL,
	`price` real NOT NULL,
	`checked_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `targets` (
	`model_key` text PRIMARY KEY NOT NULL,
	`target_price` real NOT NULL
);
