CREATE TABLE `banks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bank_number` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`is_occupied` integer DEFAULT false NOT NULL,
	`current_queue_entry_id` integer,
	`total_served` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `queue_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ticket_number` integer NOT NULL,
	`priority_type` text DEFAULT 'none' NOT NULL,
	`is_priority` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`called_at` integer,
	`started_at` integer,
	`completed_at` integer,
	`service_time_ms` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sound_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sound_type` text DEFAULT 'chime' NOT NULL,
	`sound_volume` integer DEFAULT 70 NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`animation_type` text DEFAULT 'pulse' NOT NULL,
	`animation_speed` text DEFAULT 'normal' NOT NULL,
	`custom_sound_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `system_config` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`total_banks` integer DEFAULT 5 NOT NULL,
	`current_queue_number` integer DEFAULT 0 NOT NULL,
	`is_system_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `system_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_type` text NOT NULL,
	`bank_id` integer,
	`queue_entry_id` integer,
	`metadata` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`openId` text NOT NULL,
	`name` text,
	`email` text,
	`loginMethod` text,
	`role` text DEFAULT 'user' NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`lastSignedIn` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_openId_unique` ON `users` (`openId`);