CREATE TABLE `league_match_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`pairing_id` text NOT NULL,
	`game_night_id` text NOT NULL,
	`board_id` text NOT NULL,
	`team_a_id` text NOT NULL,
	`team_b_id` text NOT NULL,
	`status` text NOT NULL,
	`starting_score` integer NOT NULL,
	`finish_rule` text NOT NULL,
	`legs_per_match` integer NOT NULL,
	`dummy_score` integer DEFAULT 0 NOT NULL,
	`winner_team_id` text,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`pairing_id`) REFERENCES `game_night_board_pairings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_night_id`) REFERENCES `game_nights`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`board_id`) REFERENCES `game_night_boards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_a_id`) REFERENCES `game_night_teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_b_id`) REFERENCES `game_night_teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`winner_team_id`) REFERENCES `game_night_teams`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `league_match_sessions_pairing_unique` ON `league_match_sessions` (`pairing_id`);--> statement-breakpoint
CREATE INDEX `league_match_sessions_game_night_idx` ON `league_match_sessions` (`game_night_id`);--> statement-breakpoint
CREATE INDEX `league_match_sessions_board_idx` ON `league_match_sessions` (`board_id`);--> statement-breakpoint
CREATE INDEX `league_match_sessions_status_idx` ON `league_match_sessions` (`status`);--> statement-breakpoint
CREATE TABLE `league_match_turns` (
	`id` text PRIMARY KEY NOT NULL,
	`match_session_id` text NOT NULL,
	`turn_index` integer NOT NULL,
	`leg_number` integer NOT NULL,
	`team_id` text NOT NULL,
	`team_member_id` text,
	`league_player_id` text,
	`display_name` text NOT NULL,
	`is_dummy` integer NOT NULL,
	`score_entered` integer NOT NULL,
	`score_before` integer NOT NULL,
	`score_after` integer NOT NULL,
	`darts_thrown` integer NOT NULL,
	`is_bust` integer NOT NULL,
	`is_checkout` integer NOT NULL,
	`checkout_confirmed` integer NOT NULL,
	`voided_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`match_session_id`) REFERENCES `league_match_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `game_night_teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_member_id`) REFERENCES `game_night_team_members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`league_player_id`) REFERENCES `league_players`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `league_match_turns_session_index_unique` ON `league_match_turns` (`match_session_id`,`turn_index`);--> statement-breakpoint
CREATE INDEX `league_match_turns_session_idx` ON `league_match_turns` (`match_session_id`);--> statement-breakpoint
CREATE INDEX `league_match_turns_player_idx` ON `league_match_turns` (`league_player_id`);--> statement-breakpoint
CREATE INDEX `league_match_turns_team_idx` ON `league_match_turns` (`team_id`);--> statement-breakpoint
ALTER TABLE `game_night_settings` ADD `dummy_score` integer DEFAULT 0 NOT NULL;