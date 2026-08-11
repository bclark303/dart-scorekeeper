CREATE TABLE `league_board_devices` (
	`id` text PRIMARY KEY NOT NULL,
	`league_id` text NOT NULL,
	`name` text NOT NULL,
	`board_number` integer NOT NULL,
	`status` text NOT NULL,
	`credential_hash` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`last_seen_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `league_board_devices_league_board_unique` ON `league_board_devices` (`league_id`,`board_number`);--> statement-breakpoint
CREATE INDEX `league_board_devices_league_idx` ON `league_board_devices` (`league_id`);--> statement-breakpoint
CREATE INDEX `league_board_devices_status_idx` ON `league_board_devices` (`status`);