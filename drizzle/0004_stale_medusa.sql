ALTER TABLE `order_items` ADD `needs_preparation` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `direct_sale` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `needs_preparation` integer DEFAULT true NOT NULL;