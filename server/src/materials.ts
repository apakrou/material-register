import { and, asc, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { MATERIAL_STATUSES, MATERIAL_TYPES, materials, plants } from "./db/schema";

// Columns the client is allowed to sort by. Mapping a name to a column (instead of
// passing user input into ORDER BY) means only these columns can ever be used.
const SORTABLE_COLUMNS = {
  materialNumber: materials.materialNumber,
  description: materials.description,
  unitPrice: materials.unitPrice,
  quantityOnHand: materials.quantityOnHand,
  updatedAt: materials.updatedAt,
};

// Validates the query string. The front end uses the same param names in its own URL.
export const listMaterialsQuery = z.object({
  q: z.string().trim().max(100).optional(),
  type: z.enum(MATERIAL_TYPES).optional(),
  status: z.enum(MATERIAL_STATUSES).optional(),
  plant: z.string().regex(/^\d{4}$/, "Plant code must be 4 digits").optional(),
  sort: z.enum(Object.keys(SORTABLE_COLUMNS) as [keyof typeof SORTABLE_COLUMNS]).default("materialNumber"),
  order: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type ListMaterialsQuery = z.infer<typeof listMaterialsQuery>;

// Escape LIKE wildcards so a search for "50%" matches the literal text.
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

export async function listMaterials(query: ListMaterialsQuery) {
  const { q, type, status, plant, sort, order, page, pageSize } = query;

  const conditions: (SQL | undefined)[] = [];
  if (q) {
    const pattern = `%${escapeLike(q)}%`;
    // ILIKE = case-insensitive LIKE
    conditions.push(
      or(
        ilike(materials.materialNumber, pattern),
        ilike(materials.description, pattern),
        ilike(materials.manufacturerPartNumber, pattern),
      ),
    );
  }
  if (type) conditions.push(eq(materials.materialType, type));
  if (status) conditions.push(eq(materials.status, status));
  if (plant) conditions.push(eq(plants.code, plant));
  const where = and(...conditions); // and() ignores undefined entries

  const sortColumn = SORTABLE_COLUMNS[sort];
  const direction = order === "asc" ? asc : desc;

  // Run the page query and the total count in parallel, with the same WHERE.
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: materials.id,
        materialNumber: materials.materialNumber,
        description: materials.description,
        materialType: materials.materialType,
        manufacturer: materials.manufacturer,
        manufacturerPartNumber: materials.manufacturerPartNumber,
        status: materials.status,
        unitOfMeasure: materials.unitOfMeasure,
        unitPrice: materials.unitPrice,
        quantityOnHand: materials.quantityOnHand,
        updatedAt: materials.updatedAt,
        plant: { code: plants.code, name: plants.name },
      })
      .from(materials)
      .innerJoin(plants, eq(materials.plantId, plants.id))
      .where(where)
      // id as a tie-breaker keeps the order stable, so rows don't move between pages
      .orderBy(direction(sortColumn), direction(materials.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: count() })
      .from(materials)
      .innerJoin(plants, eq(materials.plantId, plants.id))
      .where(where),
  ]);

  return {
    data: rows,
    total,
    pageCount: Math.ceil(total / pageSize),
    // Echo the validated query (with defaults applied) so the UI doesn't need its own copy of the defaults.
    query,
  };
}

export function listPlants() {
  return db.select().from(plants).orderBy(plants.code);
}
