CREATE TABLE `numbering_rules` (
	`kind` text PRIMARY KEY NOT NULL,
	`prefix` text NOT NULL,
	`suffix` text DEFAULT '' NOT NULL,
	`digits` integer NOT NULL,
	`start` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `bom_lines` ADD `scrap_rate` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `materials` ADD `unit` text DEFAULT 'pcs' NOT NULL;--> statement-breakpoint
ALTER TABLE `manufacturing_sites` ADD `address` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `manufacturing_sites` ADD `latitude` real;--> statement-breakpoint
ALTER TABLE `manufacturing_sites` ADD `longitude` real;--> statement-breakpoint
ALTER TABLE `manufacturing_sites` ADD `location_precision` text DEFAULT '未定位' NOT NULL;--> statement-breakpoint
ALTER TABLE `manufacturing_sites` ADD `location_source` text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE TRIGGER materials_global_number_insert BEFORE INSERT ON materials WHEN EXISTS(SELECT 1 FROM products WHERE number=NEW.number) OR EXISTS(SELECT 1 FROM assemblies WHERE number=NEW.number) BEGIN SELECT RAISE(ABORT, 'GLOBAL_PART_NUMBER_CONFLICT'); END;

--> statement-breakpoint
CREATE TRIGGER materials_global_number_update BEFORE UPDATE OF number ON materials WHEN NEW.number <> OLD.number AND (EXISTS(SELECT 1 FROM products WHERE number=NEW.number) OR EXISTS(SELECT 1 FROM assemblies WHERE number=NEW.number)) BEGIN SELECT RAISE(ABORT, 'GLOBAL_PART_NUMBER_CONFLICT'); END;

--> statement-breakpoint
CREATE TRIGGER products_global_number_insert BEFORE INSERT ON products WHEN EXISTS(SELECT 1 FROM materials WHERE number=NEW.number) OR EXISTS(SELECT 1 FROM assemblies WHERE number=NEW.number) BEGIN SELECT RAISE(ABORT, 'GLOBAL_PART_NUMBER_CONFLICT'); END;

--> statement-breakpoint
CREATE TRIGGER products_global_number_update BEFORE UPDATE OF number ON products WHEN NEW.number <> OLD.number AND (EXISTS(SELECT 1 FROM materials WHERE number=NEW.number) OR EXISTS(SELECT 1 FROM assemblies WHERE number=NEW.number)) BEGIN SELECT RAISE(ABORT, 'GLOBAL_PART_NUMBER_CONFLICT'); END;

--> statement-breakpoint
CREATE TRIGGER assemblies_global_number_insert BEFORE INSERT ON assemblies WHEN EXISTS(SELECT 1 FROM materials WHERE number=NEW.number) OR EXISTS(SELECT 1 FROM products WHERE number=NEW.number) BEGIN SELECT RAISE(ABORT, 'GLOBAL_PART_NUMBER_CONFLICT'); END;

--> statement-breakpoint
CREATE TRIGGER assemblies_global_number_update BEFORE UPDATE OF number ON assemblies WHEN NEW.number <> OLD.number AND (EXISTS(SELECT 1 FROM materials WHERE number=NEW.number) OR EXISTS(SELECT 1 FROM products WHERE number=NEW.number)) BEGIN SELECT RAISE(ABORT, 'GLOBAL_PART_NUMBER_CONFLICT'); END;

--> statement-breakpoint
CREATE TRIGGER bom_lines_cycle_insert BEFORE INSERT ON bom_lines WHEN NEW.child_assembly_id IS NOT NULL AND EXISTS (WITH RECURSIVE reachable(id) AS (SELECT NEW.child_assembly_id UNION SELECT l.child_assembly_id FROM reachable r JOIN boms b ON b.assembly_id=r.id AND b.status='生效' JOIN bom_lines l ON l.bom_id=b.id WHERE l.child_assembly_id IS NOT NULL AND l.id<>NEW.id) SELECT 1 FROM reachable WHERE id=(SELECT assembly_id FROM boms WHERE id=NEW.bom_id)) BEGIN SELECT RAISE(ABORT,'BOM_CYCLE'); END;

--> statement-breakpoint
CREATE TRIGGER bom_lines_cycle_update BEFORE UPDATE OF child_assembly_id,bom_id ON bom_lines WHEN NEW.child_assembly_id IS NOT NULL AND EXISTS (WITH RECURSIVE reachable(id) AS (SELECT NEW.child_assembly_id UNION SELECT l.child_assembly_id FROM reachable r JOIN boms b ON b.assembly_id=r.id AND b.status='生效' JOIN bom_lines l ON l.bom_id=b.id WHERE l.child_assembly_id IS NOT NULL AND l.id<>NEW.id) SELECT 1 FROM reachable WHERE id=(SELECT assembly_id FROM boms WHERE id=NEW.bom_id)) BEGIN SELECT RAISE(ABORT,'BOM_CYCLE'); END;
