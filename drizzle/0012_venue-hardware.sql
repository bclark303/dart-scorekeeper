CREATE TABLE `venues` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `status` text NOT NULL,
  `created_by_user_id` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `venues_name_idx` ON `venues` (`name`);
--> statement-breakpoint
CREATE INDEX `venues_status_idx` ON `venues` (`status`);
--> statement-breakpoint
CREATE TABLE `league_venues` (
  `id` text PRIMARY KEY NOT NULL,
  `league_id` text NOT NULL,
  `venue_id` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `league_venues_league_venue_unique` ON `league_venues` (`league_id`,`venue_id`);
--> statement-breakpoint
CREATE INDEX `league_venues_league_idx` ON `league_venues` (`league_id`);
--> statement-breakpoint
CREATE INDEX `league_venues_venue_idx` ON `league_venues` (`venue_id`);
--> statement-breakpoint
CREATE TABLE `physical_boards` (
  `id` text PRIMARY KEY NOT NULL,
  `venue_id` text NOT NULL,
  `board_number` integer NOT NULL,
  `name` text NOT NULL,
  `status` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `physical_boards_venue_number_unique` ON `physical_boards` (`venue_id`,`board_number`);
--> statement-breakpoint
CREATE INDEX `physical_boards_venue_idx` ON `physical_boards` (`venue_id`);
--> statement-breakpoint
CREATE INDEX `physical_boards_status_idx` ON `physical_boards` (`status`);
--> statement-breakpoint
INSERT INTO `venues` (`id`,`name`,`status`,`created_by_user_id`,`created_at`,`updated_at`)
SELECT 'venue_default', 'Default Venue', 'active', `created_by_user_id`, `created_at`, `updated_at`
FROM `leagues`
ORDER BY `created_at`, `id`
LIMIT 1;
--> statement-breakpoint
INSERT INTO `league_venues` (`id`,`league_id`,`venue_id`,`created_at`)
SELECT 'league-venue-' || `id`, `id`, 'venue_default', `created_at`
FROM `leagues`
WHERE EXISTS (SELECT 1 FROM `venues` WHERE `id` = 'venue_default');
--> statement-breakpoint
INSERT INTO `physical_boards` (`id`,`venue_id`,`board_number`,`name`,`status`,`created_at`,`updated_at`)
SELECT
  'venue_default-board-' || board_number,
  'venue_default',
  board_number,
  'Board ' || board_number,
  'active',
  CAST(strftime('%s','now') AS integer) * 1000,
  CAST(strftime('%s','now') AS integer) * 1000
FROM (
  SELECT DISTINCT `board_number` AS board_number FROM `league_board_devices`
  UNION
  SELECT DISTINCT `board_number` AS board_number FROM `game_night_boards`
)
WHERE board_number IS NOT NULL
  AND EXISTS (SELECT 1 FROM `venues` WHERE `id` = 'venue_default');
--> statement-breakpoint
ALTER TABLE `game_nights` ADD `venue_id` text REFERENCES `venues`(`id`) ON DELETE set null;
--> statement-breakpoint
UPDATE `game_nights` SET `venue_id` = 'venue_default'
WHERE EXISTS (SELECT 1 FROM `venues` WHERE `id` = 'venue_default');
--> statement-breakpoint
CREATE INDEX `game_nights_venue_id_idx` ON `game_nights` (`venue_id`);
--> statement-breakpoint
ALTER TABLE `game_night_boards` ADD `physical_board_id` text REFERENCES `physical_boards`(`id`) ON DELETE set null;
--> statement-breakpoint
UPDATE `game_night_boards`
SET `physical_board_id` = 'venue_default-board-' || `board_number`
WHERE EXISTS (SELECT 1 FROM `venues` WHERE `id` = 'venue_default');
--> statement-breakpoint
CREATE UNIQUE INDEX `game_night_boards_night_physical_unique` ON `game_night_boards` (`game_night_id`,`physical_board_id`);
--> statement-breakpoint
CREATE INDEX `game_night_boards_physical_board_idx` ON `game_night_boards` (`physical_board_id`);
--> statement-breakpoint
CREATE TABLE `__new_league_board_devices` (
  `id` text PRIMARY KEY NOT NULL,
  `league_id` text,
  `board_number` integer,
  `venue_id` text NOT NULL,
  `physical_board_id` text,
  `name` text NOT NULL,
  `status` text NOT NULL,
  `credential_hash` text NOT NULL,
  `created_by_user_id` text NOT NULL,
  `last_seen_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`physical_board_id`) REFERENCES `physical_boards`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_league_board_devices`
  (`id`,`league_id`,`board_number`,`venue_id`,`physical_board_id`,`name`,`status`,`credential_hash`,`created_by_user_id`,`last_seen_at`,`created_at`,`updated_at`)
SELECT
  `device`.`id`,
  `device`.`league_id`,
  `device`.`board_number`,
  'venue_default',
  CASE
    WHEN `device`.`board_number` IS NOT NULL
      AND `device`.`id` = (
        SELECT `first_device`.`id`
        FROM `league_board_devices` AS `first_device`
        WHERE `first_device`.`board_number` = `device`.`board_number`
        ORDER BY `first_device`.`created_at`, `first_device`.`id`
        LIMIT 1
      )
    THEN 'venue_default-board-' || `device`.`board_number`
    ELSE NULL
  END,
  `device`.`name`,
  `device`.`status`,
  `device`.`credential_hash`,
  `device`.`created_by_user_id`,
  `device`.`last_seen_at`,
  `device`.`created_at`,
  `device`.`updated_at`
FROM `league_board_devices` AS `device`;
--> statement-breakpoint
DROP TABLE `league_board_devices`;
--> statement-breakpoint
ALTER TABLE `__new_league_board_devices` RENAME TO `league_board_devices`;
--> statement-breakpoint
CREATE UNIQUE INDEX `board_devices_physical_board_unique` ON `league_board_devices` (`physical_board_id`);
--> statement-breakpoint
CREATE INDEX `board_devices_venue_idx` ON `league_board_devices` (`venue_id`);
--> statement-breakpoint
CREATE INDEX `board_devices_status_idx` ON `league_board_devices` (`status`);
