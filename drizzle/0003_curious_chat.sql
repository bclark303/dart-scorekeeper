CREATE TABLE `league_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`league_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `league_memberships_league_user_unique` ON `league_memberships` (`league_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `league_memberships_league_id_idx` ON `league_memberships` (`league_id`);--> statement-breakpoint
CREATE INDEX `league_memberships_user_id_idx` ON `league_memberships` (`user_id`);--> statement-breakpoint
CREATE INDEX `league_memberships_status_idx` ON `league_memberships` (`status`);--> statement-breakpoint
CREATE TABLE `leagues` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer
);
--> statement-breakpoint
CREATE INDEX `leagues_name_idx` ON `leagues` (`name`);--> statement-breakpoint
CREATE INDEX `leagues_status_idx` ON `leagues` (`status`);--> statement-breakpoint
CREATE INDEX `leagues_created_by_user_id_idx` ON `leagues` (`created_by_user_id`);--> statement-breakpoint
CREATE INDEX `leagues_archived_at_idx` ON `leagues` (`archived_at`);--> statement-breakpoint
CREATE TABLE `seasons` (
	`id` text PRIMARY KEY NOT NULL,
	`league_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `seasons_league_id_idx` ON `seasons` (`league_id`);--> statement-breakpoint
CREATE INDEX `seasons_status_idx` ON `seasons` (`status`);--> statement-breakpoint
CREATE INDEX `seasons_starts_at_idx` ON `seasons` (`starts_at`);