CREATE TABLE `league_players` (
	`id` text PRIMARY KEY NOT NULL,
	`league_id` text NOT NULL,
	`player_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `league_players_league_player_unique` ON `league_players` (`league_id`,`player_id`);--> statement-breakpoint
CREATE INDEX `league_players_league_id_idx` ON `league_players` (`league_id`);--> statement-breakpoint
CREATE INDEX `league_players_player_id_idx` ON `league_players` (`player_id`);--> statement-breakpoint
CREATE INDEX `league_players_status_idx` ON `league_players` (`status`);--> statement-breakpoint
CREATE TABLE `season_roster_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`league_player_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`league_player_id`) REFERENCES `league_players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `season_roster_entries_season_player_unique` ON `season_roster_entries` (`season_id`,`league_player_id`);--> statement-breakpoint
CREATE INDEX `season_roster_entries_season_id_idx` ON `season_roster_entries` (`season_id`);--> statement-breakpoint
CREATE INDEX `season_roster_entries_league_player_id_idx` ON `season_roster_entries` (`league_player_id`);--> statement-breakpoint
CREATE INDEX `season_roster_entries_status_idx` ON `season_roster_entries` (`status`);