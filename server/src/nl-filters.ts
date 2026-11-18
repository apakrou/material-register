// Natural-language filters: turn "obsolete bearings in Brisbane" into
// { q: "bearing", status: "Obsolete", plant: "1000" } using an LLM via OpenRouter.
//
// The LLM's reply is treated as untrusted input: we validate it with Zod and drop
// anything that isn't an allowed value. The front end then puts the result in the
// URL, so it goes through the normal /api/materials validation as well.
import { z } from "zod";
import { MATERIAL_STATUSES, MATERIAL_TYPES } from "./db/schema";
import { listPlants } from "./materials";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

export const nlFiltersRequest = z.object({
  text: z.string().trim().min(1, "Type what you're looking for").max(200),
});

// .catch(undefined) drops a single bad field (e.g. an invented status) instead of
// rejecting the whole answer.
const llmFilters = z.object({
  q: z.string().trim().min(1).max(100).optional().catch(undefined),
  type: z.enum(MATERIAL_TYPES).optional().catch(undefined),
  status: z.enum(MATERIAL_STATUSES).optional().catch(undefined),
  plant: z.string().regex(/^\d{4}$/).optional().catch(undefined),
});

export type NlFilters = z.infer<typeof llmFilters>;

export function isNlFiltersConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

async function buildSystemPrompt() {
  const plants = await listPlants();
  const plantList = plants.map((p) => `${p.code} (${p.name})`).join(", ");
  return `You convert a maintenance planner's request into filters for a materials catalogue.
Reply with ONLY a JSON object. Allowed keys, all optional:
- "q": one search keyword matched against material number, description or manufacturer part number. Use the singular form ("bearing", not "bearings").
- "type": one of ${MATERIAL_TYPES.map((t) => `"${t}"`).join(", ")}
- "status": one of ${MATERIAL_STATUSES.map((s) => `"${s}"`).join(", ")}
- "plant": the 4-digit code of one of these plants: ${plantList}
Leave out any key the request doesn't mention. Never invent values.
Example: "obsolete bearings in Brisbane" -> {"q":"bearing","status":"Obsolete","plant":"1000"}`;
}

export async function textToFilters(text: string): Promise<NlFilters> {
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL,
      temperature: 0, // we want the same answer for the same question
      messages: [
        { role: "system", content: await buildSystemPrompt() },
        { role: "user", content: text },
      ],
    }),
    signal: AbortSignal.timeout(15_000), // don't leave the user waiting forever
  });

  if (!response.ok) {
    throw new Error(`OpenRouter returned ${response.status}: ${await response.text()}`);
  }

  const body = await response.json();
  const content: string = body.choices?.[0]?.message?.content ?? "";
  // Models sometimes wrap JSON in prose or ```code fences```, so take the {...} part.
  const json = content.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error(`No JSON in LLM reply: ${content}`);

  return llmFilters.parse(JSON.parse(json));
}
