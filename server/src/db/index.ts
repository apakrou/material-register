import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5433/materials";

// drizzle creates a pg connection pool from the URL
export const db = drizzle(DATABASE_URL, { schema });
