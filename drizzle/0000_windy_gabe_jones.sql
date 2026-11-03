CREATE TABLE `assemblies` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`revision` text DEFAULT 'A.0' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assemblies_number_unique` ON `assemblies` (`number`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bom_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`bom_id` text NOT NULL,
	`material_id` text,
	`child_assembly_id` text,
	`quantity` real NOT NULL,
	`references` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`bom_id`) REFERENCES `boms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`child_assembly_id`) REFERENCES `assemblies`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bom_item_exclusive" CHECK(("bom_lines"."material_id" IS NOT NULL AND "bom_lines"."child_assembly_id" IS NULL) OR ("bom_lines"."material_id" IS NULL AND "bom_lines"."child_assembly_id" IS NOT NULL)),
	CONSTRAINT "positive_bom_quantity" CHECK("bom_lines"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE `boms` (
	`id` text PRIMARY KEY NOT NULL,
	`assembly_id` text NOT NULL,
	`revision` text NOT NULL,
	`status` text DEFAULT '生效' NOT NULL,
	FOREIGN KEY (`assembly_id`) REFERENCES `assemblies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assembly_bom_unique` ON `boms` (`assembly_id`,`revision`);--> statement-breakpoint
CREATE TABLE `materials` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`package` text NOT NULL,
	`lifecycle` text DEFAULT '量产' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`parameters` text DEFAULT '{}' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `materials_number_unique` ON `materials` (`number`);--> statement-breakpoint
CREATE TABLE `mpn_sites` (
	`id` text PRIMARY KEY NOT NULL,
	`mpn_id` text NOT NULL,
	`site_id` text NOT NULL,
	`stage` text NOT NULL,
	`source` text NOT NULL,
	`verified_at` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`mpn_id`) REFERENCES `mpns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`site_id`) REFERENCES `manufacturing_sites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `mpns` (
	`id` text PRIMARY KEY NOT NULL,
	`material_id` text NOT NULL,
	`manufacturer` text NOT NULL,
	`mpn` text NOT NULL,
	`approval` text DEFAULT '待验证' NOT NULL,
	`lifecycle` text DEFAULT '在产' NOT NULL,
	`datasheet` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mpn_unique` ON `mpns` (`material_id`,`manufacturer`,`mpn`);--> statement-breakpoint
CREATE TABLE `product_assemblies` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`assembly_id` text NOT NULL,
	`quantity` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assembly_id`) REFERENCES `assemblies`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "positive_product_quantity" CHECK("product_assemblies"."quantity" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_assembly_unique` ON `product_assemblies` (`product_id`,`assembly_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`name` text NOT NULL,
	`family` text NOT NULL,
	`status` text DEFAULT '量产' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_number_unique` ON `products` (`number`);--> statement-breakpoint
CREATE TABLE `manufacturing_sites` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`operator` text NOT NULL,
	`country` text NOT NULL,
	`city` text NOT NULL
);
