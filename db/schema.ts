import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
  check,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
export const materials = sqliteTable("materials", {
  id: text("id").primaryKey(),
  number: text("number").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  package: text("package").notNull(),
  lifecycle: text("lifecycle").notNull().default("量产"),
  description: text("description").notNull().default(""),
  parameters: text("parameters").notNull().default("{}"),
  updatedAt: text("updated_at").notNull(),
});
export const mpns = sqliteTable(
  "mpns",
  {
    id: text("id").primaryKey(),
    materialId: text("material_id")
      .notNull()
      .references(() => materials.id),
    manufacturer: text("manufacturer").notNull(),
    mpn: text("mpn").notNull(),
    approval: text("approval").notNull().default("待验证"),
    lifecycle: text("lifecycle").notNull().default("在产"),
    datasheet: text("datasheet").notNull().default(""),
    notes: text("notes").notNull().default(""),
  },
  (t) => [uniqueIndex("mpn_unique").on(t.materialId, t.manufacturer, t.mpn)],
);
export const sites = sqliteTable("manufacturing_sites", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  operator: text("operator").notNull(),
  country: text("country").notNull(),
  city: text("city").notNull(),
});
export const mpnSites = sqliteTable("mpn_sites", {
  id: text("id").primaryKey(),
  mpnId: text("mpn_id")
    .notNull()
    .references(() => mpns.id),
  siteId: text("site_id")
    .notNull()
    .references(() => sites.id),
  stage: text("stage").notNull(),
  source: text("source").notNull(),
  verifiedAt: text("verified_at").notNull().default(""),
});
export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  number: text("number").notNull().unique(),
  name: text("name").notNull(),
  family: text("family").notNull(),
  status: text("status").notNull().default("量产"),
});
export const assemblies = sqliteTable("assemblies", {
  id: text("id").primaryKey(),
  number: text("number").notNull().unique(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  revision: text("revision").notNull().default("A.0"),
});
export const productAssemblies = sqliteTable(
  "product_assemblies",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    assemblyId: text("assembly_id")
      .notNull()
      .references(() => assemblies.id),
    quantity: integer("quantity").notNull(),
  },
  (t) => [
    uniqueIndex("product_assembly_unique").on(t.productId, t.assemblyId),
    check("positive_product_quantity", sql`${t.quantity} > 0`),
  ],
);
export const boms = sqliteTable(
  "boms",
  {
    id: text("id").primaryKey(),
    assemblyId: text("assembly_id")
      .notNull()
      .references(() => assemblies.id),
    revision: text("revision").notNull(),
    status: text("status").notNull().default("生效"),
  },
  (t) => [uniqueIndex("assembly_bom_unique").on(t.assemblyId, t.revision)],
);
export const bomLines = sqliteTable(
  "bom_lines",
  {
    id: text("id").primaryKey(),
    bomId: text("bom_id")
      .notNull()
      .references(() => boms.id),
    materialId: text("material_id").references(() => materials.id),
    childAssemblyId: text("child_assembly_id").references(() => assemblies.id),
    quantity: real("quantity").notNull(),
    references: text("references").notNull().default(""),
    notes: text("notes").notNull().default(""),
  },
  (t) => [
    check(
      "bom_item_exclusive",
      sql`(${t.materialId} IS NOT NULL AND ${t.childAssemblyId} IS NULL) OR (${t.materialId} IS NULL AND ${t.childAssemblyId} IS NOT NULL)`,
    ),
    check("positive_bom_quantity", sql`${t.quantity} > 0`),
  ],
);
export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  createdAt: text("created_at").notNull(),
});
