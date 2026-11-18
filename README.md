# Material Register

A small full-stack app for searching, filtering, sorting and paging through a catalogue of 10,000 material records (spare parts, consumables, raw materials and tools).

- **Database:** PostgreSQL 17 (Docker Compose), schema and migrations with Drizzle ORM
- **API:** Node + TypeScript, Express 5, Zod validation
- **Front end:** React Router v7 in SPA mode, shadcn/ui and Tailwind CSS v4

## Getting started

Requirements: Node 22 or later and Docker. **Docker Desktop must be running** before `npm run setup`. If you see "failed to connect to the docker API", start it first, for example with `open -a Docker` on macOS.

```bash
npm install
npm run setup   # starts Postgres, runs migrations, seeds 10,000 materials
npm run dev     # API on :3001, web app on http://localhost:5173
```

**Optional, natural-language filters.** Run `cp server/.env.example server/.env`, then choose one:

- **OpenRouter (free models):** get a free key at https://openrouter.ai/keys and set `LLM_API_KEY` in `server/.env`. Free models are shared, so they're sometimes rate-limited.
- **Local model with [Ollama](https://ollama.com) (no key, no rate limits):** run `ollama pull gemma3:12b`, then set `LLM_API_URL=http://localhost:11434/v1` and `LLM_MODEL=gemma3:12b` in `server/.env`. This needs about 8 GB of RAM.

Restart `npm run dev`. Without either, the rest of the app works normally and the natural-language box explains that it isn't set up.

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
  src/nl-filters.ts         Natural-language filters: prompt, LLM call, validation of the reply
  src/*.test.ts             API tests
web/
  app/routes/materials.tsx  The page: clientLoader (fetching), error state
  app/components/           Natural-language box, toolbar (search and filters), table, pagination
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

`POST /api/nl-filters` with body `{ "text": "obsolete bearings in Brisbane" }` returns filters such as `{ "q": "bearing", "status": "Obsolete", "plant": "1000" }`. It returns `503` if no API key is set, and `502` if the LLM fails or replies with something unusable.

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

**Optional extra: natural-language filters.** Type "obsolete bearings in Brisbane" and press Enter. The flow:
1. The API sends the text to an LLM with `temperature: 0`. It works with any OpenAI-compatible chat API: OpenRouter's free models by default, or a local model through Ollama. The system prompt lists the allowed values, including the real plant codes and names from the database, so "Brisbane" maps to `1000`.
2. **The reply is treated as untrusted input.** We extract the JSON, then Zod validates each field. A made-up value such as `"status": "Broken"` is dropped instead of failing the whole answer.
3. The front end writes the filters to the **URL**, the same as the normal controls. So the request goes through the normal `/api/materials` validation again, and the search box and dropdowns show exactly what the LLM chose. The user can check it, adjust it, and share or refresh the link.

Design choices:
- It only runs when you submit, not on every keystroke, because each submit is an LLM call.
- It has a 30-second timeout, which allows for a local model loading into memory on first use.
- If the key is missing or the LLM fails, it shows a clear message, and the rest of the app is unaffected.
- Free models come and go and are often rate-limited. So `LLM_MODEL` takes a list, and OpenRouter falls back to the next model automatically. If all of them are busy, the user is told to retry in a few seconds.
- The endpoint is configurable (`LLM_API_URL`), so the same code can run a local model through Ollama. That has no rate limits and no network dependency, and the data never leaves the machine, which matters for real customer catalogues.
- Trade-off: the LLM can only choose values that already exist as filters. Manufacturer isn't a filter, so "SKF bearings" can't narrow by manufacturer.

**Tests.** 23 tests across two files:
- `server/src/app.test.ts` runs the real Express app (through supertest) against the seeded database. It covers search, filters, sorting, pagination and validation. I used the real database rather than mocks because the main risk is the SQL itself.
- `server/src/nl-filters.test.ts` mocks only the LLM API call, and tests our side:
  - parsing a reply wrapped in prose
  - dropping invented values
  - sending the plant list
  - the fallback model list
  - local-model configuration (custom URL, no key)
  - the 503, 400, 429 and 502 errors

## What I'd do next

- **Faster search:** add `pg_trgm` GIN indexes on description, material number and MPN, so `ILIKE '%term%'` can use an index. Measure it with `EXPLAIN ANALYZE` on a larger dataset, around 1M rows. For word-based search ("bearing 25mm"), use Postgres full-text search with a `tsvector` column.
- **Keyset pagination** for very deep pages, or an estimated count for huge result sets. `count(*)` gets expensive at millions of rows.
- **End-to-end types** with tRPC or a shared package, to remove the duplicated response types.
- **Multi-select filters** (several plants at once), a manufacturer filter, and a page-size selector.
- **Detail and edit view** for a single material.
- **Natural-language filters:** use structured outputs (a JSON schema in the request) on models that support it, add a manufacturer filter so "SKF bearings" works, and cache answers for repeated questions.
- **Front-end tests** for the URL-state logic and the debounce, plus an end-to-end Playwright test.
- **Production setup:** serve the built SPA and the API from one origin (or configure CORS), add structured logging and a health-check endpoint, and use a separate test database.

## How I used AI tools

I built this with **Claude Code** as my coding agent, and treated it like a fast pair programmer. It wrote most of the code. I set the direction, reviewed the output, tested it on my own machine, and pushed back when something was wrong or more complicated than it needed to be.

**How I worked with it**
- I started by asking it to read the brief closely and build the simplest design that met every requirement. I treated code complexity as a cost to keep down: a minimal, working product first, with nothing added without a clear reason. That ruled out extras like a state library, a separate types package or tRPC for two endpoints.
- I chose shadcn/ui as the UI library, kept the database, API and front end in one repo with npm workspaces, and wanted setup to be three commands.
- Larger changes, like the natural-language filters, went on a separate branch. I only merged them into `main` after testing them on my Mac.
- [`CLAUDE.md`](./CLAUDE.md) gives any agent the project's structure, commands and conventions. It also has step-by-step checklists for adding a filter or a column, which keeps the agent's changes consistent with the rest of the code.

**What worked well**
- Scaffolding: the Drizzle schema and migrations, the Express setup, the shadcn components and the React Router SPA setup.
- Realistic seed data. Templates like "Bearing, deep groove ball, 25mm bore" with real-looking part numbers make the search demo meaningful.
- Writing tests, and testing its own work in a headless browser before handing it to me. That caught three bugs before I ever saw them:
  - React Router's SPA mode only allows `HydrateFallback` on the root route.
  - Two versions of Vite were installed, which broke the plugin types.
  - The debounced search box trimmed a trailing space while I was still typing.
- A final audit before submitting. I had the agent go through the brief line by line, clone the repo fresh from GitHub, follow the README, and check every requirement in a browser. That caught a race condition: clicking Clear sometimes put the filters back. The search box's 300 ms debounce timer still held the old URL, and when it fired it undid the Clear. The fix was to pause the timer while another change is loading, then restart it with the current URL.

**What I had to correct or steer**
- **Intermittent 502 errors on my Mac.** The agent's first guess was a keep-alive problem in the Vite proxy. The change it made didn't fix anything. I pasted the dev server logs, which showed the real cause: `tsx watch` was also watching files in `node_modules`. iCloud sync on my Desktop folder kept touching those files, so the API restarted every few seconds, and requests that landed mid-restart failed. We excluded `node_modules` from the watcher and reverted the proxy change, and I moved the project out of the iCloud-synced Desktop. The lesson: read the logs before changing code.
- **The optional extra.** The agent first chose tests as the one optional extra. I switched it to natural-language filters, because they fit an AI-native role and make a better demo. The tests stayed, as normal quality practice.
- **Free models in practice.** I first tried OpenRouter's free models, and they weren't reliable:
  - The first default model (Llama 3.3 70B) had been withdrawn from the free tier (HTTP 404).
  - The next one (Gemma 4 31B) was rate-limited (HTTP 429). Free models share one pool of capacity across all users, so requests are refused when it's busy.
  
  We added OpenRouter's model fallback list and a clear "busy, try again" message. But a shared free pool isn't something I'd rely on in a live demo, so I decided to run a smaller model on my own laptop instead. Ollama speaks the same API, so making the API URL configurable was enough: the app now runs `gemma3:12b` locally. That means no API key, no rate limits, and the catalogue data never leaves the machine. OpenRouter remains the default for anyone without a local model.
- **Verifying what the sandbox couldn't.** The agent's cloud sandbox couldn't reach OpenRouter or Ollama. So it tested everything around the LLM call against mocked replies: the prompt contents, parsing, validation, errors, and the UI with a mocked response. I tested the real model end to end on my Mac with Ollama. The first request after starting Ollama timed out while the model loaded into memory. Retrying worked, so I warm the model up before demos.
- **Smaller things.**
  - I set up Docker Desktop for the database.
  - I checked the npm audit warnings. They come from Drizzle's development tooling. The suggested `npm audit fix --force` would downgrade `drizzle-kit` and break migrations, so I left it.
  - The shadcn component registry was blocked in the agent's sandbox, so the component source was copied from the shadcn/ui repo instead. `npx shadcn add` works normally on my machine.
- **Keeping it honest.** I had the agent check the indexes with `EXPLAIN ANALYZE`. Rather than claiming they speed everything up, the README says which ones actually matter at 10,000 rows.
