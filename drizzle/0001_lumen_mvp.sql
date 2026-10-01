CREATE TABLE `agent_devices` (
	`id` varchar(36) NOT NULL,
	`owner_id` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`status` enum('active','revoked') NOT NULL DEFAULT 'active',
	`last_seen_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`revoked_at` timestamp,
	CONSTRAINT `agent_devices_id` PRIMARY KEY(`id`),
	CONSTRAINT `agent_devices_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `agent_pairing_codes` (
	`id` varchar(36) NOT NULL,
	`owner_id` int NOT NULL,
	`code_hash` varchar(64) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`used_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_pairing_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `agent_pairing_codes_code_hash_unique` UNIQUE(`code_hash`)
);
--> statement-breakpoint
CREATE TABLE `approval_requests` (
	`id` varchar(36) NOT NULL,
	`owner_id` int NOT NULL,
	`context` enum('personal','home','business') NOT NULL,
	`category` enum('financial','home','business','security') NOT NULL,
	`title` varchar(120) NOT NULL,
	`details` text NOT NULL,
	`amount_cents` int,
	`currency` varchar(3),
	`status` enum('pending','approved','rejected','expired') NOT NULL DEFAULT 'pending',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`expires_at` timestamp NOT NULL,
	`decided_at` timestamp,
	CONSTRAINT `approval_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` varchar(36) NOT NULL,
	`owner_id` int NOT NULL,
	`context` enum('personal','home','business') NOT NULL,
	`actor` enum('user','agent','system') NOT NULL,
	`event` varchar(64) NOT NULL,
	`summary` varchar(240) NOT NULL,
	`resource_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `authorized_assets` (
	`id` varchar(36) NOT NULL,
	`owner_id` int NOT NULL,
	`context` enum('personal','home','business') NOT NULL,
	`kind` enum('device','network','server') NOT NULL,
	`label` varchar(100) NOT NULL,
	`authorization_confirmed` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `authorized_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `memory_notes` (
	`id` varchar(36) NOT NULL,
	`owner_id` int NOT NULL,
	`context` enum('personal','home','business') NOT NULL,
	`kind` enum('preference','pending') NOT NULL,
	`title` varchar(120) NOT NULL,
	`content` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `memory_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `agent_devices` ADD CONSTRAINT `agent_devices_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_pairing_codes` ADD CONSTRAINT `agent_pairing_codes_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approval_requests` ADD CONSTRAINT `approval_requests_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_events` ADD CONSTRAINT `audit_events_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `authorized_assets` ADD CONSTRAINT `authorized_assets_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `memory_notes` ADD CONSTRAINT `memory_notes_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;