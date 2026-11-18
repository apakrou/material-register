# Material Register

A small full-stack app for searching, filtering, sorting and paging through a catalogue of 10,000 material records (spare parts, consumables, raw materials and tools).

- **Database:** PostgreSQL 17 (Docker Compose), schema and migrations with Drizzle ORM
- **API:** Node + TypeScript, Express 5, Zod validation
- **Front end:** React Router v7 in SPA mode, shadcn/ui and Tailwind CSS v4

## Getting started

Requirements: Node 20.19 or later (22 recommended) and Docker.

```bash
npm install
npm run setup   # starts Postgres, runs migrations, seeds 10,000 materials
npm run dev     # API on :3001, web app on http://localhost:5173
```

Other commands:

| Command | What it does |
| --- | --- |
| `npm test` | API integration tests (needs the seeded database) |
| `npm run typecheck` | Type-checks the server and web packages |
| `npm run db:seed` | Re-seeds the data (safe to re-run) |
| `npm run db:generate -w server` | Generates a migration after changing `server/src/db/schema.ts` |

Postgres runs on host port **5433** so it doesn't clash with a local install on 5432. To use a different database, set `DATABASE_URL`.

## Project structure

```
docker-compose.yml          Postgres
server/
  src/db/schema.ts          Tables, enums and indexes (Drizzle)
  src/db/seed.ts            Generates the realistic, deterministic seed data
  drizzle/                  Generated SQL migrations
  src/materials.ts          Input validation (Zod) and the query (search, filters, sort, pagination)
  src/app.ts                Express routes and error handling
  src/app.test.ts           API tests
web/
  app/routes/materials.tsx  The page: clientLoader (fetching), error state
  app/components/           Toolbar (search and filters), table, pagination
  app/components/ui/        shadcn/ui components
  app/lib/                  API types and fetch helper, URL-state hook
```

## How it works

A request goes from the URL to the database and back like this:

1. **The URL holds all table state:** `/?q=bearing&status=Active&plant=1000&sort=unitPrice&order=desc&page=2`. Components never store filters in React state. They change the URL with `setSearchParams`.
2. **React Router's `clientLoader`** runs whenever the URL changes. It passes the query string straight through to `GET /api/materials`, because the page and the API use the same parameter names.
3. **The API validates** the query string with Zod. It rejects bad input with a `400` and the field errors, and it fills in defaults: sort by material number, ascending, page 1, 25 rows.
4. **One SQL query** (built with Drizzle) does the search, filtering, sorting and `LIMIT`/`OFFSET`. A second query with the same `WHERE` counts the total. Both run in parallel.
5. **The response echoes the validated query**, so the UI shows the sort, filters and page the server actually used. The defaults live in one place, on the server.

### API

`GET /api/materials`

| Param | Values | Default |
| --- | --- | --- |
| `q` | Text, max 100 characters. Case-insensitive match on material number, description or MPN | none |
| `type` | `Spare Part`, `Consumable`, `Raw Material`, `Tool` | none |
| `status` | `Active`, `Obsolete`, `Pending Review` | none |
| `plant` | 4-digit plant code, e.g. `1000` | none |
| `sort` | `materialNumber`, `description`, `unitPrice`, `quantityOnHand`, `updatedAt` | `materialNumber` |
| `order` | `asc`, `desc` | `asc` |
| `page` | ≥ 1 | `1` |
| `pageSize` | 1–100 | `25` |

Response: `{ data: Material[], total, pageCount, query }`.

`GET /api/plants`: all plants, used to fill the plant filter.

## Decisions and trade-offs

**REST over tRPC.** There are two read-only endpoints. REST with Zod gives the same runtime validation and is easy to test with curl or a browser. The cost is that the response types are written twice (`web/app/lib/api.ts` mirrors the server). With more endpoints, I'd switch to tRPC or a shared types package.

**Express 5.** It's widely known, and version 5 sends errors from async handlers to the error middleware, so no `try/catch` wrappers are needed. Unexpected errors are logged on the server. The client only gets a generic 500.

**URL as the single source of truth.** Refreshing, sharing a link, and the back and forward buttons all work without extra code. Search, filter and sort changes reset to page 1. Typing in search *replaces* the history entry, so the back button isn't filled with partial words.

**React Router `clientLoader` instead of TanStack Query.** The router already does what this page needs:
- It re-fetches when the URL changes.
- It reports loading through `useNavigation`.
- It sends failures to the `ErrorBoundary`.
- It **aborts stale requests** with `request.signal`, so a slow response can't overwrite a newer one.

There's no client cache. Going back re-fetches, which is cheap here. TanStack Query would add caching and background refetching if those were needed.

**Debounced search (300 ms).** The input keeps its own text in local state and only writes to the URL after 300 ms without typing. That gives one request per pause, not one per keystroke.

**Schema**
- Only `plants` gets its own table, linked by a foreign key, because a plant has its own attributes (code and name).
- Manufacturer stays a text column on `materials` to keep things simple. In a real SAP sync it would probably be a table.
- `material_type` and `status` are Postgres enums, shared with the Zod validation through one constant. The database rejects invalid values, and Drizzle infers the TypeScript types. The trade-off is that adding a value needs a migration (`ALTER TYPE ... ADD VALUE`).
- `unit_price` is `numeric(12,2)`, not a float, so money stays exact. The driver returns it as a string, and the UI formats it with `Intl.NumberFormat`.

**Indexes**
- `material_number` and `plants.code` are unique, which also indexes them.
- `plant_id` is indexed because Postgres doesn't index foreign keys automatically.
- `status`, `material_type` and `updated_at` have B-tree indexes for filtering and sorting.
- At 10,000 rows Postgres mostly chooses a sequential scan anyway: the search query runs in about 14 ms (checked with `EXPLAIN ANALYZE`). The indexes matter at real catalogue sizes, and mostly for selective values. `status = 'Active'` matches about 80% of rows, so an index doesn't help it.
- The search uses `ILIKE '%term%'`, which a B-tree index can't help with. That's the first thing I'd change at scale (see below).

**Sorting and pagination**
- `id` is always added as a tie-breaker in `ORDER BY`. Without it, rows with equal values (the same price, say) can appear on two pages or on none.
- Sort columns come from a fixed map, so user input never reaches `ORDER BY` directly.
- Pagination uses `OFFSET`, which is simple and supports "jump to page N". It gets slow deep into very large tables.

**Search escaping.** `%` and `_` in the search box are escaped, so they match literally instead of acting as SQL wildcards. Drizzle sends all values as bound parameters, so there's no SQL injection risk.

**Error, empty and loading states**
- On the first load, a skeleton shows while the first fetch runs (`HydrateFallback`).
- While re-fetching, the table fades and a spinner shows. The old rows stay on screen, so the layout doesn't jump.
- When nothing matches, the table shows a message and a "Clear filters" button.
- If the API is down, or the URL has invalid parameters, an alert explains the problem and offers "Try again" or "Reset view".

**Seed data.** It uses faker with a fixed seed, so every run produces the same data and the tests are repeatable. Records come from templates that read like real catalogue entries, such as "Bearing, deep groove ball, 25mm bore" (SKF, MPN `6205-2RS`), rather than lorem ipsum. Rows are inserted in batches of 1,000 to stay under Postgres' limit of 65,535 parameters per query.

**Optional extra: tests.** `server/src/app.test.ts` has 13 integration tests. They run the real Express app (through supertest) against the seeded database, covering search, filters, sorting, pagination and validation. I chose real-database tests over mocks because the main risk is the SQL itself.

## What I'd do next

- **Faster search:** add `pg_trgm` GIN indexes on description, material number and MPN, so `ILIKE '%term%'` can use an index. Measure it with `EXPLAIN ANALYZE` on a larger dataset, around 1M rows. For word-based search ("bearing 25mm"), use Postgres full-text search with a `tsvector` column.
- **Keyset pagination** for very deep pages, or an estimated count for huge result sets. `count(*)` gets expensive at millions of rows.
- **End-to-end types** with tRPC or a shared package, to remove the duplicated response types.
- **Multi-select filters** (several plants at once), a manufacturer filter, and a page-size selector.
- **Detail and edit view** for a single material.
- **Front-end tests** for the URL-state logic and the debounce, plus an end-to-end Playwright test.
- **Production setup:** serve the built SPA and the API from one origin (or configure CORS), add structured logging and a health-check endpoint, and use a separate test database.

## How I used AI tools

I built this with **Claude Code**.

- **What worked well:** scaffolding the boilerplate (Drizzle schema, Express setup, shadcn components), writing the realistic seed templates, and drafting the tests.
- **What I had to correct or check myself:**
  - React Router's SPA mode only allows `HydrateFallback` on the **root** route. The first version put it on the page route, and the dev server failed. I moved it to `root.tsx`.
  - Two versions of Vite were installed (one pulled in by Vitest, one by the web app), which broke the plugin types. I aligned both on one version and used Vite's built-in tsconfig path handling instead of an extra plugin.
  - The first version of the search sync trimmed the input text while the user was still typing: typing "ball " lost the trailing space. The fix only overwrites the input when the URL value differs from the trimmed text.
  - The shadcn registry wasn't reachable from the sandbox, so the component source was copied from the shadcn/ui repo. `components.json` is set up, so `npx shadcn add <component>` works normally.
  - Checked that the indexes are justified, with `EXPLAIN ANALYZE`, and kept the README honest about which ones matter at this data size.
- **Agent context:** [`CLAUDE.md`](./CLAUDE.md) describes the structure, commands and conventions for agents working in this repo.
