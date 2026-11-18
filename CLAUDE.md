# CLAUDE.md

Context for AI coding agents working in this repo.

## What this is
Material Register: a table of materials with search, filters, sorting and server-side pagination.
npm workspaces: `server/` (Express 5 + Drizzle + Postgres) and `web/` (React Router v7 SPA + shadcn/ui).

## Commands (run from the repo root)
- `npm run setup`: start Postgres (Docker, port 5433), migrate, seed
- `npm run dev`: API on :3001 and web on :5173 (Vite proxies `/api` to the API)
- `npm test`: API integration tests against the seeded database
- `npm run typecheck`: run this after every change
- `npm run db:generate -w server`: create a migration after editing `server/src/db/schema.ts`, then `npm run db:migrate`

## Principles
- Keep it simple. Prefer the smallest change that solves the problem; don't add libraries or layers without a clear reason.
- All search, filtering, sorting and pagination happen in SQL, never in the browser.
- The URL query string is the only store for table state. The page's params are passed straight through to `GET /api/materials`, so param names must match on both sides.
- The server validates every input with Zod (`server/src/materials.ts`) and applies the defaults. The response echoes the validated `query`, and the UI reads state from it.
- Never put user input into SQL directly. Sortable columns come from the `SORTABLE_COLUMNS` map.

## Natural-language filters
`server/src/nl-filters.ts` asks an LLM through any OpenAI-compatible API (OpenRouter by default, or local Ollama; settings in `server/.env`, see `.env.example`) to turn text into `{ q, type, status, plant }`. The reply is untrusted: Zod drops invalid fields. The UI writes the result to the URL. Tests mock `fetch`; never call the real API in tests.
If you add a filter, also add it to the prompt and to the `llmFilters` schema there.

## How to add a filter (e.g. manufacturer)
1. `server/src/materials.ts`: add the param to `listMaterialsQuery` and push an `eq(...)` condition in `listMaterials`.
2. `web/app/lib/api.ts`: add the field to `MaterialsResponse["query"]`.
3. `web/app/components/materials-toolbar.tsx`: add a `<FilterSelect>`; include it in `hasFilters`.
4. `web/app/routes/materials.tsx`: add the param to `clearFilters`.
5. Add it to the prompt and the `llmFilters` schema in `server/src/nl-filters.ts`, and to `nl-search.tsx`.
6. Add a test in `server/src/app.test.ts`. Run `npm run typecheck && npm test`.

## How to add a column
- If it's a new database field: add it in `schema.ts`, generate and run a migration, and update `seed.ts`.
- Add it to the `select` in `listMaterials` and to the `Material` type in `web/app/lib/api.ts`.
- Add a `<TableHead>` and a `<TableCell>` in `materials-table.tsx`, and update `COLUMN_COUNT`.
- To make it sortable, add it to `SORTABLE_COLUMNS` and to the `SortColumn` type, then use `<SortableHead>`.

## UI conventions
- shadcn/ui components live in `web/app/components/ui/`. Add new ones with `npx shadcn@latest add <name>` (run in `web/`).
- Import alias `~/` points to `web/app/`.
