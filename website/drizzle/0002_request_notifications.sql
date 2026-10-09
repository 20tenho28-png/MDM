CREATE TABLE `request_notifications` (
	`request_id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_attempt` integer DEFAULT 0 NOT NULL,
	`accepted_at` integer,
	`provider_id` text,
	FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON UPDATE no action ON DELETE no action
);
