import express, { type ErrorRequestHandler } from "express";
import { z } from "zod";
import { listMaterials, listMaterialsQuery, listPlants } from "./materials";
import { isNlFiltersConfigured, LlmError, nlFiltersRequest, textToFilters } from "./nl-filters";

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

app.post("/api/nl-filters", express.json(), async (req, res) => {
  if (!isNlFiltersConfigured()) {
    res.status(503).json({ error: "Natural-language search isn't set up. Add OPENROUTER_API_KEY to server/.env" });
    return;
  }
  const parsed = nlFiltersRequest.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: z.flattenError(parsed.error).fieldErrors });
    return;
  }
  try {
    res.json(await textToFilters(parsed.data.text));
  } catch (err) {
    // LLM down, rate-limited or gave an unusable answer: log it, give the user a clear message.
    console.error(err);
    if (err instanceof LlmError && err.status === 429) {
      res.status(429).json({ error: "The free AI model is busy right now. Try again in a few seconds." });
      return;
    }
    res.status(502).json({ error: "Couldn't interpret that right now. Try again, or use the filters." });
  }
});

// Express 5 passes errors thrown in async handlers here.
// Log the real error, but don't leak internals to the client.
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
};
app.use(errorHandler);
