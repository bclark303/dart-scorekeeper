CREATE TABLE `game_night_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`league_id` text NOT NULL,
	`name` text NOT NULL,
	`settings_json` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_night_templates_league_name_unique` ON `game_night_templates` (`league_id`,`name`);--> statement-breakpoint
CREATE INDEX `game_night_templates_league_id_idx` ON `game_night_templates` (`league_id`);--> statement-breakpoint
CREATE INDEX `game_night_templates_default_idx` ON `game_night_templates` (`league_id`,`is_default`);