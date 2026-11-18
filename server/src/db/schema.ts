import {
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// Fixed sets of values. Exported so the API validation uses exactly the same lists.
export const MATERIAL_TYPES = ["Spare Part", "Consumable", "Raw Material", "Tool"] as const;
export const MATERIAL_STATUSES = ["Active", "Obsolete", "Pending Review"] as const;

export const materialType = pgEnum("material_type", MATERIAL_TYPES);
export const materialStatus = pgEnum("material_status", MATERIAL_STATUSES);

export const plants = pgTable("plants", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 4 }).notNull().unique(), // SAP plant code, e.g. "1000"
  name: text("name").notNull(), // e.g. "Brisbane"
});

export const materials = pgTable(
  "materials",
  {
    id: serial("id").primaryKey(),
    materialNumber: varchar("material_number", { length: 20 }).notNull().unique(), // MAT-000123
    description: text("description").notNull(),
    materialType: materialType("material_type").notNull(),
    manufacturer: text("manufacturer").notNull(),
    manufacturerPartNumber: text("manufacturer_part_number").notNull(),
    plantId: integer("plant_id")
      .notNull()
      .references(() => plants.id),
    status: materialStatus("status").notNull().default("Active"),
    unitOfMeasure: varchar("unit_of_measure", { length: 3 }).notNull(), // EA, KG, M, L...
    // numeric (not float) so money is exact. node-postgres returns it as a string.
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(), // AUD
    quantityOnHand: integer("quantity_on_hand").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Postgres does not index foreign keys automatically
    index("materials_plant_id_idx").on(t.plantId),
    // Columns we filter on
    index("materials_status_idx").on(t.status),
    index("materials_material_type_idx").on(t.materialType),
    // Default sort for "recently changed" views
    index("materials_updated_at_idx").on(t.updatedAt),
  ],
);
