CREATE TABLE `match_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`side_id` text NOT NULL,
	`player_id` text,
	`slot_index` integer NOT NULL,
	`display_name` text NOT NULL,
	`is_dummy` integer NOT NULL,
	FOREIGN KEY (`side_id`) REFERENCES `match_sides`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `match_participants_side_slot_unique` ON `match_participants` (`side_id`,`slot_index`);--> statement-breakpoint
CREATE INDEX `match_participants_side_id_idx` ON `match_participants` (`side_id`);--> statement-breakpoint
CREATE INDEX `match_participants_player_id_idx` ON `match_participants` (`player_id`);--> statement-breakpoint
CREATE TABLE `match_sides` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`side_index` integer NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `match_sides_match_position_unique` ON `match_sides` (`match_id`,`side_index`);--> statement-breakpoint
CREATE INDEX `match_sides_match_id_idx` ON `match_sides` (`match_id`);--> statement-breakpoint
CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`game_type` text NOT NULL,
	`status` text NOT NULL,
	`winner_side_id` text,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`updated_at` integer NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE INDEX `matches_game_type_idx` ON `matches` (`game_type`);--> statement-breakpoint
CREATE INDEX `matches_status_idx` ON `matches` (`status`);--> statement-breakpoint
CREATE INDEX `matches_completed_at_idx` ON `matches` (`completed_at`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer
);
--> statement-breakpoint
CREATE INDEX `players_display_name_idx` ON `players` (`display_name`);--> statement-breakpoint
CREATE INDEX `players_archived_at_idx` ON `players` (`archived_at`);--> statement-breakpoint
CREATE TABLE `x01_darts` (
	`id` text PRIMARY KEY NOT NULL,
	`turn_id` text NOT NULL,
	`dart_index` integer NOT NULL,
	`segment` text NOT NULL,
	`multiplier` integer NOT NULL,
	`score` integer NOT NULL,
	FOREIGN KEY (`turn_id`) REFERENCES `x01_turns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `x01_darts_turn_position_unique` ON `x01_darts` (`turn_id`,`dart_index`);--> statement-breakpoint
CREATE INDEX `x01_darts_turn_id_idx` ON `x01_darts` (`turn_id`);--> statement-breakpoint
CREATE TABLE `x01_legs` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`leg_number` integer NOT NULL,
	`starting_side_id` text NOT NULL,
	`winner_side_id` text,
	`started_at` integer,
	`completed_at` integer,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`starting_side_id`) REFERENCES `match_sides`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`winner_side_id`) REFERENCES `match_sides`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `x01_legs_match_number_unique` ON `x01_legs` (`match_id`,`leg_number`);--> statement-breakpoint
CREATE INDEX `x01_legs_match_id_idx` ON `x01_legs` (`match_id`);--> statement-breakpoint
CREATE TABLE `x01_match_settings` (
	`match_id` text PRIMARY KEY NOT NULL,
	`starting_score` integer NOT NULL,
	`finish_rule` text NOT NULL,
	`best_of_legs` integer NOT NULL,
	`score_entry_mode` text NOT NULL,
	`rotation_mode` text NOT NULL,
	`dummy_score` integer NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `x01_turns` (
	`id` text PRIMARY KEY NOT NULL,
	`leg_id` text NOT NULL,
	`side_id` text NOT NULL,
	`participant_id` text,
	`turn_number` integer NOT NULL,
	`score_entered` integer NOT NULL,
	`score_before` integer NOT NULL,
	`score_after` integer NOT NULL,
	`darts_thrown` integer NOT NULL,
	`is_bust` integer NOT NULL,
	`is_checkout` integer NOT NULL,
	`finish_rule` text NOT NULL,
	`recorded_at` integer,
	FOREIGN KEY (`leg_id`) REFERENCES `x01_legs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`side_id`) REFERENCES `match_sides`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`participant_id`) REFERENCES `match_participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `x01_turns_leg_number_unique` ON `x01_turns` (`leg_id`,`turn_number`);--> statement-breakpoint
CREATE INDEX `x01_turns_leg_id_idx` ON `x01_turns` (`leg_id`);--> statement-breakpoint
CREATE INDEX `x01_turns_side_id_idx` ON `x01_turns` (`side_id`);--> statement-breakpoint
CREATE INDEX `x01_turns_participant_id_idx` ON `x01_turns` (`participant_id`);