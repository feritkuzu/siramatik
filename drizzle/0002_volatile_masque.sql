CREATE TABLE `ticket_design` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_name` text DEFAULT 'SIRAMATIK' NOT NULL,
	`company_subtitle` text DEFAULT 'Sıra Numarası Sistemi' NOT NULL,
	`logo_url` text,
	`header_text` text,
	`footer_text` text,
	`ticket_width` integer DEFAULT 58 NOT NULL,
	`show_queue_position` integer DEFAULT true NOT NULL,
	`show_datetime` integer DEFAULT true NOT NULL,
	`show_bank_info` integer DEFAULT true NOT NULL,
	`custom_message_1` text,
	`custom_message_2` text,
	`custom_message_3` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
