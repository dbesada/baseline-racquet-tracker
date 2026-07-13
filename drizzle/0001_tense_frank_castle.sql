CREATE TABLE `retailer_settings` (
	`retailer_key` text PRIMARY KEY NOT NULL,
	`retailer_name` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL
);
