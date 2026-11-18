import express, { type ErrorRequestHandler } from "express";
import { z } from "zod";
import { listMaterials, listMaterialsQuery, listPlants } from "./materials";

export const app = express();

app.get("/api/plants", async (_req, res) => {
  res.json(await listPlants());
});

app.get("/api/materials", async (req, res) => {
  const parsed = listMaterialsQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid query parameters",
      details: z.flattenError(parsed.error).fieldErrors,
    });
    return;
  }
  res.json(await listMaterials(parsed.data));
});

// Express 5 passes errors thrown in async handlers here.
// Log the real error, but don't leak internals to the client.
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
};
app.use(errorHandler);
