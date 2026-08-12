ALTER TABLE `game_night_settings` ADD `round_count` integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `game_night_settings` ADD `pairing_strategy` text DEFAULT 'random' NOT NULL;--> statement-breakpoint
ALTER TABLE `game_night_settings` ADD `round_advance_mode` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `game_night_settings` ADD `round_advance_delay_seconds` integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE `game_night_settings` ADD `intermission_after_rounds` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `game_night_settings` ADD `intermission_duration_minutes` integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE `game_night_teams` ADD `status` text DEFAULT 'active' NOT NULL;