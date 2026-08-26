CREATE TABLE `league_match_darts` (
	`id` text PRIMARY KEY NOT NULL,
	`turn_id` text NOT NULL,
	`dart_index` integer NOT NULL,
	`segment` text NOT NULL,
	`multiplier` integer NOT NULL,
	`score` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`turn_id`) REFERENCES `league_match_turns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `league_match_darts_turn_index_unique` ON `league_match_darts` (`turn_id`,`dart_index`);--> statement-breakpoint
CREATE INDEX `league_match_darts_turn_idx` ON `league_match_darts` (`turn_id`);