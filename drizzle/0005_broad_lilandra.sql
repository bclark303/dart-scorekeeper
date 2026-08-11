CREATE TABLE `game_night_attendance` (
	`id` text PRIMARY KEY NOT NULL,
	`game_night_id` text NOT NULL,
	`league_player_id` text NOT NULL,
	`status` text NOT NULL,
	`dues_status` text NOT NULL,
	`checked_in_at` integer,
	`dues_updated_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`game_night_id`) REFERENCES `game_nights`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`league_player_id`) REFERENCES `league_players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_night_attendance_night_player_unique` ON `game_night_attendance` (`game_night_id`,`league_player_id`);--> statement-breakpoint
CREATE INDEX `game_night_attendance_game_night_id_idx` ON `game_night_attendance` (`game_night_id`);--> statement-breakpoint
CREATE INDEX `game_night_attendance_league_player_id_idx` ON `game_night_attendance` (`league_player_id`);--> statement-breakpoint
CREATE INDEX `game_night_attendance_status_idx` ON `game_night_attendance` (`status`);--> statement-breakpoint
CREATE INDEX `game_night_attendance_dues_status_idx` ON `game_night_attendance` (`dues_status`);--> statement-breakpoint
CREATE TABLE `game_night_board_pairings` (
	`id` text PRIMARY KEY NOT NULL,
	`game_night_id` text NOT NULL,
	`board_id` text NOT NULL,
	`round_number` integer NOT NULL,
	`team_a_id` text NOT NULL,
	`team_b_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`game_night_id`) REFERENCES `game_nights`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`board_id`) REFERENCES `game_night_boards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_a_id`) REFERENCES `game_night_teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_b_id`) REFERENCES `game_night_teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_night_pairings_round_board_unique` ON `game_night_board_pairings` (`game_night_id`,`round_number`,`board_id`);--> statement-breakpoint
CREATE INDEX `game_night_pairings_game_night_id_idx` ON `game_night_board_pairings` (`game_night_id`);--> statement-breakpoint
CREATE INDEX `game_night_pairings_board_id_idx` ON `game_night_board_pairings` (`board_id`);--> statement-breakpoint
CREATE INDEX `game_night_pairings_team_a_id_idx` ON `game_night_board_pairings` (`team_a_id`);--> statement-breakpoint
CREATE INDEX `game_night_pairings_team_b_id_idx` ON `game_night_board_pairings` (`team_b_id`);--> statement-breakpoint
CREATE TABLE `game_night_boards` (
	`id` text PRIMARY KEY NOT NULL,
	`game_night_id` text NOT NULL,
	`board_number` integer NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`game_night_id`) REFERENCES `game_nights`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_night_boards_night_number_unique` ON `game_night_boards` (`game_night_id`,`board_number`);--> statement-breakpoint
CREATE INDEX `game_night_boards_game_night_id_idx` ON `game_night_boards` (`game_night_id`);--> statement-breakpoint
CREATE TABLE `game_night_settings` (
	`game_night_id` text PRIMARY KEY NOT NULL,
	`team_creation_mode` text NOT NULL,
	`target_team_count` integer NOT NULL,
	`min_team_players` integer NOT NULL,
	`max_team_players` integer NOT NULL,
	`dummy_player_mode` text NOT NULL,
	`board_count` integer NOT NULL,
	`board_rotation_type` text NOT NULL,
	`legs_per_match` integer NOT NULL,
	`starting_score` integer NOT NULL,
	`finish_rule` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`game_night_id`) REFERENCES `game_nights`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `game_night_team_members` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`league_player_id` text,
	`slot_index` integer NOT NULL,
	`display_name` text NOT NULL,
	`is_dummy` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `game_night_teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`league_player_id`) REFERENCES `league_players`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_night_team_members_team_slot_unique` ON `game_night_team_members` (`team_id`,`slot_index`);--> statement-breakpoint
CREATE INDEX `game_night_team_members_team_id_idx` ON `game_night_team_members` (`team_id`);--> statement-breakpoint
CREATE INDEX `game_night_team_members_league_player_id_idx` ON `game_night_team_members` (`league_player_id`);--> statement-breakpoint
CREATE TABLE `game_night_teams` (
	`id` text PRIMARY KEY NOT NULL,
	`game_night_id` text NOT NULL,
	`team_index` integer NOT NULL,
	`name` text NOT NULL,
	`source` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`game_night_id`) REFERENCES `game_nights`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_night_teams_night_index_unique` ON `game_night_teams` (`game_night_id`,`team_index`);--> statement-breakpoint
CREATE INDEX `game_night_teams_game_night_id_idx` ON `game_night_teams` (`game_night_id`);--> statement-breakpoint
CREATE TABLE `game_nights` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`name` text NOT NULL,
	`scheduled_at` integer NOT NULL,
	`status` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `game_nights_season_id_idx` ON `game_nights` (`season_id`);--> statement-breakpoint
CREATE INDEX `game_nights_scheduled_at_idx` ON `game_nights` (`scheduled_at`);--> statement-breakpoint
CREATE INDEX `game_nights_status_idx` ON `game_nights` (`status`);