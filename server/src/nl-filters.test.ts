// Tests for natural-language filters. The OpenRouter call is mocked: we test our side
// (prompting, parsing, validation, error handling), not the model.
import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "./app";
import { db } from "./db";

afterAll(() => db.$client.end());

// Pretend OpenRouter replied with this message content.
function mockLlmReply(content: string, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status }),
  );
}

const ask = (text: unknown) => request(app).post("/api/nl-filters").send({ text });

describe("POST /api/nl-filters", () => {
  beforeEach(() => vi.stubEnv("OPENROUTER_API_KEY", "test-key"));
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("returns 503 when no API key is configured", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const res = await ask("obsolete bearings in Brisbane");
    expect(res.status).toBe(503);
  });

  it("rejects empty text", async () => {
    const res = await ask("   ");
    expect(res.status).toBe(400);
  });

  it("turns the LLM reply into filters, even when wrapped in prose", async () => {
    mockLlmReply('Here you go:\n```json\n{"q":"bearing","status":"Obsolete","plant":"1000"}\n```');
    const res = await ask("obsolete bearings in Brisbane");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ q: "bearing", status: "Obsolete", plant: "1000" });
  });

  it("drops values the LLM made up instead of trusting them", async () => {
    mockLlmReply('{"q":"pump","type":"Spaceship","status":"Broken","plant":"Brisbane"}');
    const res = await ask("broken spaceship pumps");
    expect(res.body).toEqual({ q: "pump" });
  });

  it("sends the plant list to the model so it can map names to codes", async () => {
    const fetchSpy = mockLlmReply("{}");
    await ask("anything in Perth");
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body.messages[0].content).toContain("4000 (Perth)");
    expect(body.messages[1]).toEqual({ role: "user", content: "anything in Perth" });
  });

  it("sends a fallback list of models, configurable through OPENROUTER_MODEL", async () => {
    vi.stubEnv("OPENROUTER_MODEL", "model-a:free, model-b:free");
    const fetchSpy = mockLlmReply("{}");
    await ask("bearings");
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body.models).toEqual(["model-a:free", "model-b:free"]);
  });

  it("tells the user to retry when the free models are rate-limited", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {}); // keep test output clean
    mockLlmReply("rate limited", 429);
    const res = await ask("obsolete bearings");
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/busy/);
  });

  it("returns 502 with a friendly message when the LLM fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockLlmReply("server error", 500);
    const res = await ask("obsolete bearings");
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/Couldn't interpret/);
  });

  it("returns 502 when the reply has no JSON", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockLlmReply("Sorry, I can't help with that.");
    const res = await ask("obsolete bearings");
    expect(res.status).toBe(502);
  });
});
