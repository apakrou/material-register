// Integration tests: run the real Express app against the seeded database.
// Prerequisite: npm run setup (database running, migrated and seeded).
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "./app";
import { db } from "./db";

afterAll(() => db.$client.end());

const getMaterials = (query: Record<string, string>) => request(app).get("/api/materials").query(query);

describe("GET /api/materials", () => {
  it("returns the first page with defaults applied", async () => {
    const res = await getMaterials({});
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(25);
    expect(res.body.total).toBeGreaterThanOrEqual(5000);
    expect(res.body.pageCount).toBe(Math.ceil(res.body.total / 25));
    expect(res.body.query).toMatchObject({ sort: "materialNumber", order: "asc", page: 1, pageSize: 25 });
    expect(res.body.data[0].plant).toEqual({ code: expect.any(String), name: expect.any(String) });
  });

  it("searches case-insensitively", async () => {
    const lower = await getMaterials({ q: "bearing" });
    const upper = await getMaterials({ q: "BEARING" });
    expect(lower.body.total).toBeGreaterThan(0);
    expect(upper.body.total).toBe(lower.body.total);
  });

  it("searches material number and manufacturer part number too", async () => {
    const byNumber = await getMaterials({ q: "mat-000123" });
    expect(byNumber.body.data[0].materialNumber).toBe("MAT-000123");

    const mpn = byNumber.body.data[0].manufacturerPartNumber;
    const byMpn = await getMaterials({ q: mpn });
    expect(byMpn.body.data.map((m: { manufacturerPartNumber: string }) => m.manufacturerPartNumber)).toContain(mpn);
  });

  it("treats % and _ in the search as literal characters", async () => {
    const res = await getMaterials({ q: "%" });
    expect(res.body.total).toBe(0);
  });

  it("combines search and filters", async () => {
    const res = await getMaterials({ q: "bearing", status: "Active", plant: "1000", pageSize: "100" });
    expect(res.body.total).toBeGreaterThan(0);
    for (const m of res.body.data) {
      expect(m.description.toLowerCase()).toContain("bearing");
      expect(m.status).toBe("Active");
      expect(m.plant.code).toBe("1000");
    }
  });

  it("sorts numerically by unit price, descending", async () => {
    const res = await getMaterials({ sort: "unitPrice", order: "desc", pageSize: "50" });
    const prices = res.body.data.map((m: { unitPrice: string }) => Number(m.unitPrice));
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
  });

  it("paginates without overlapping rows", async () => {
    const page1 = await getMaterials({ page: "1" });
    const page2 = await getMaterials({ page: "2" });
    const ids1 = page1.body.data.map((m: { id: number }) => m.id);
    const ids2 = page2.body.data.map((m: { id: number }) => m.id);
    expect(ids1.filter((id: number) => ids2.includes(id))).toEqual([]);
  });

  it.each<Record<string, string>>([
    { pageSize: "1000" },
    { page: "0" },
    { sort: "password" },
    { status: "Deleted" },
    { plant: "1000; DROP TABLE materials" },
  ])("rejects invalid input %o with 400", async (query) => {
    const res = await getMaterials(query);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid query parameters");
  });
});

describe("GET /api/plants", () => {
  it("lists plants ordered by code", async () => {
    const res = await request(app).get("/api/plants");
    expect(res.status).toBe(200);
    const codes = res.body.map((p: { code: string }) => p.code);
    expect(codes).toEqual([...codes].sort());
  });
});
