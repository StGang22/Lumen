CREATE TABLE `agent_jobs` (
	`id` varchar(36) NOT NULL,
	`owner_id` int NOT NULL,
	`device_id` varchar(36) NOT NULL,
	`context` enum('personal','home','business') NOT NULL DEFAULT 'personal',
	`command` text NOT NULL,
	`cwd` varchar(500),
	`timeout_seconds` int NOT NULL DEFAULT 30,
	`status` enum('pending_approval','approved','rejected','running','completed','failed','cancelled') NOT NULL DEFAULT 'pending_approval',
	`stdout` text,
	`stderr` text,
	`exit_code` int,
	`error_message` varchar(500),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`approved_at` timestamp,
	`started_at` timestamp,
	`finished_at` timestamp,
	CONSTRAINT `agent_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `agent_jobs` ADD CONSTRAINT `agent_jobs_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `agent_jobs` ADD CONSTRAINT `agent_jobs_device_id_agent_devices_id_fk` FOREIGN KEY (`device_id`) REFERENCES `agent_devices`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `agent_jobs_device_status_idx` ON `agent_jobs` (`device_id`, `status`);
--> statement-breakpoint
CREATE INDEX `agent_jobs_owner_created_idx` ON `agent_jobs` (`owner_id`, `created_at`);
