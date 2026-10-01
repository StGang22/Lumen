CREATE TABLE `session_revocation_policy` (
	`id` int NOT NULL,
	`invalidated_before` timestamp(3) NOT NULL,
	CONSTRAINT `session_revocation_policy_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
INSERT INTO `session_revocation_policy` (`id`, `invalidated_before`) VALUES (1, CURRENT_TIMESTAMP(3));
