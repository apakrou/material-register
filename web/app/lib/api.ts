// Response types for the API. These mirror server/src/materials.ts.
// (A shared package or tRPC would remove this duplication; see README.)

export const MATERIAL_TYPES = ["Spare Part", "Consumable", "Raw Material", "Tool"] as const;
export const MATERIAL_STATUSES = ["Active", "Obsolete", "Pending Review"] as const;

export type SortColumn = "materialNumber" | "description" | "unitPrice" | "quantityOnHand" | "updatedAt";

export type Plant = { id: number; code: string; name: string };

export type Material = {
  id: number;
  materialNumber: string;
  description: string;
  materialType: (typeof MATERIAL_TYPES)[number];
  manufacturer: string;
  manufacturerPartNumber: string;
  status: (typeof MATERIAL_STATUSES)[number];
  unitOfMeasure: string;
  unitPrice: string; // numeric comes back as a string to keep it exact
  quantityOnHand: number;
  updatedAt: string;
  plant: { code: string; name: string };
};

export type MaterialsResponse = {
  data: Material[];
  total: number;
  pageCount: number;
  // The query as the server understood it, with defaults applied
  query: {
    q?: string;
    type?: string;
    status?: string;
    plant?: string;
    sort: SortColumn;
    order: "asc" | "desc";
    page: number;
    pageSize: number;
  };
};

export async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { signal });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const fields = body?.details ? `: ${Object.keys(body.details).join(", ")}` : "";
    throw new Error(body?.error ? body.error + fields : `Request failed (${res.status})`);
  }
  return res.json();
}

export type NlFilters = { q?: string; type?: string; status?: string; plant?: string };

export async function postJson<T>(path: string, data: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body;
}
