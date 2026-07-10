# Plan 13 — Deterministic Playwright E2E tests for all UI flows

## Goal

Automate every implemented UI flow with Playwright, running against a real Next.js server and a real (test) Postgres database, but with **zero real external calls**: no OpenAI, no Vercel Blob, no Inngest cloud. Every external effect is replaced by a static, deterministic fake so tests never flake on network or model nondeterminism.

## Strategy: env-gated fake adapters, not network interception

The app already isolates all external I/O behind ports (`src/server/ports/`) with fake implementations that exist today but are only used by unit tests:

- `fakeTextGenerator`, `fakeImageGenerator`, `immediateDispatcher` — `src/server/services/fakes.ts`
- `inMemoryStorage` — `src/server/services/memory-storage.ts`

The composition root `src/server/container.ts` hard-wires the real adapters. The cleanest deterministic seam is to make `createDeps` env-gated rather than intercepting OpenAI/Blob/Inngest HTTP traffic from Playwright (server-side `fetch` is invisible to Playwright's `page.route`, so interception would require a separate mock proxy — more moving parts, more flake).

What stays **real**: Next.js server, better-auth (email+password against Postgres), tRPC, Prisma + Postgres (in Docker), the photo upload route (sharp re-encode), the task runner.

Note on going further with `inMemoryRepos()`: the `Repos` port covers all app data, but better-auth is wired directly to Prisma (`src/server/auth.ts`), so a DB-less mode would also require swapping the auth adapter and forcing a single server process. Not worth the fidelity loss — Postgres is already deterministic; only the LLM/blob/Inngest calls aren't. We deliberately keep the database real. What becomes **fake** in E2E mode: LLM text, image generation, blob storage, and background dispatch (tasks run inline instead of via Inngest — no `inngest-cli dev` needed).

## Phase 1 — Test-mode seam in the server

1. Add optional `E2E_FAKES` (`"1"`/unset) to `src/server/config.ts` (zod, default off). Never enabled in production builds implicitly — it's just an env var the E2E harness sets.
2. In `src/server/container.ts#createDeps`, when `config.e2eFakes` is true, return:
   - `repos: prismaRepos(client)` (unchanged — real DB keeps auth + ownership real)
   - `text: fakeTextGenerator(...)` seeded with **static fixture JSON** (see Phase 2)
   - `image: fakeImageGenerator(...)` returning a fixed tiny PNG buffer
   - `storage: inMemoryStorage()` — but see note below: stored images must be viewable by the browser. If `inMemoryStorage` URLs aren't fetchable, add a tiny read-only route `src/app/api/test-storage/[...key]/route.ts`, only mounted when `E2E_FAKES=1` (return 404 otherwise), that serves from the in-memory store. Storage URLs in fake mode point at this route.
   - `dispatcher: immediateDispatcher(...)` so `story.parse` / `story.generateBaseImage` complete synchronously; the existing `useTaskPolling` UI then observes DONE on the first poll — deterministic.
3. Verify the fakes satisfy the same handler contracts used by `parseStory.ts` and `baseImage.ts` (they already do in unit tests).

## Phase 2 — Static fixtures

Create `e2e/fixtures/`:

- `parse-result.json` — a canned structured parse output matching the schema `parseStory.ts` expects (title/pages/etc. — mirror what `src/server/__tests__/parse.int.test.ts` uses).
- `base-image.png` — a 1×1 (or small labeled) PNG checked into the repo; `fakeImageGenerator` returns its bytes.
- `photo.png` — small valid PNG for the character photo-upload flow (goes through real sharp re-encode).

The fake text generator should key responses by task type/prompt marker so future task types can add fixtures without branching logic in tests.

## Phase 3 — Playwright harness

1. **Docker Postgres**: add `docker-compose.e2e.yml` at the repo root:

   ```yaml
   services:
     postgres:
       image: postgres:17-alpine
       environment:
         POSTGRES_USER: e2e
         POSTGRES_PASSWORD: e2e
         POSTGRES_DB: social_story_e2e
       ports:
         - "5433:5432" # non-default host port to avoid clashing with local dev Postgres
       healthcheck:
         test: ["CMD-SHELL", "pg_isready -U e2e -d social_story_e2e"]
         interval: 1s
         retries: 30
   ```

   E2E `DATABASE_URL`: `postgresql://e2e:e2e@localhost:5433/social_story_e2e`.

2. Playwright `globalSetup` script: `docker compose -f docker-compose.e2e.yml up -d --wait` (healthcheck gates readiness), then `prisma migrate deploy` against the e2e URL, then truncate all tables so runs start clean. Optional `globalTeardown` runs `docker compose ... down`; keep the container up locally between runs for speed (a `test:e2e:down` script tears it down explicitly).
3. `npm i -D @playwright/test` + `npx playwright install chromium`. Chromium-only to start.
4. `playwright.config.ts`:
   - `webServer`: `npm run build && npm run start` (or `next dev`) with env `E2E_FAKES=1`, `DATABASE_URL=postgresql://e2e:e2e@localhost:5433/social_story_e2e`, dummy values for `OPENAI_TOKEN`/`BLOB_READ_WRITE_TOKEN` (config requires them but fakes never use them), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=http://localhost:3000`.
   - `use: { baseURL: "http://localhost:3000", trace: "on-first-retry" }`, `fullyParallel: false` initially (shared DB), retries 0 locally (tests must be deterministic — retries hide flake).
5. Per-test data isolation: unique user emails (`e2e+<testId>@example.com`) rather than relying on truncation between tests, so the suite can later parallelize.
6. Auth helper: a Playwright fixture `signUpAndSignIn(page)` that drives the real `/signup` form once per worker and saves `storageState` for reuse; individual specs start authenticated. Also keep one spec that exercises signin/signout explicitly.
7. npm scripts: `test:e2e` (`playwright test`), `test:e2e:ui`, `test:e2e:down` (compose down).

## Phase 4 — Specs (one file per flow)

`e2e/specs/`:

1. **auth.spec.ts** — sign up, sign out, sign in, wrong password error; unauthenticated visit to `/stories` redirects to `/signin`.
2. **stories.spec.ts** — empty state on `/stories`; create via `/stories/new` (lands on script step); story appears in list; delete story.
3. **script.spec.ts** — edit title, script, cover note; save persists across reload; **parse**: click parse → task badge reaches DONE (fake dispatcher makes this immediate) → parsed state reflected; step nav gating (characters step enabled only once script non-empty).
4. **characters.spec.ts** — add/edit/delete character; add/edit/delete visual rule; upload `photo.png` via the real upload route (`setInputFiles`) and assert the photo renders (served from the fake-storage route); base step enables once ≥1 character exists.
5. **base-image.spec.ts** — trigger generate base image → task completes → fixture image renders; retry path via `task.retry` if surfaced in UI.
6. **steps-nav.spec.ts** — walk `deriveStepStates` gating end-to-end: fresh story has only script enabled; enablement unlocks in order script → characters → base → pages (pages/export currently have no page — assert disabled/absent, extend when plans 10–12 land).

Assertions use role/label-based locators; add `data-testid` only where the DOM gives no stable handle. No `waitForTimeout` anywhere — rely on web-first assertions (`expect(locator).toHaveText(...)` auto-waits; polling at 1500ms is well within default timeout).

## Phase 5 — CI & docs

1. GitHub Actions (or equivalent) job: runners have Docker, so the same `docker compose -f docker-compose.e2e.yml up -d --wait` path from globalSetup works unchanged (no separate service-container config needed) → `npx playwright install --with-deps chromium` → `npm run test:e2e`; upload Playwright HTML report/trace on failure.
2. README/CLAUDE.md note: how to run locally (just `npm run test:e2e` — globalSetup brings up Docker Postgres; Docker must be running), and the rule that **new UI flows must ship with an E2E spec** and any new external port must ship a deterministic fake.

## Determinism checklist

- No real network: OpenAI/Blob/Inngest all replaced at the container seam; `E2E_FAKES=1` is the single switch.
- No time/randomness in assertions: fixtures are static files; task completion is synchronous via `immediateDispatcher`.
- No shared mutable state between tests: unique per-test user/story data on a dedicated DB.
- No sleeps: web-first assertions only.

## Out of scope / future

- Pages generation, page editor, PDF export flows (plans 10–12) — add specs when built.
- Visual regression screenshots — possible later since fake images are byte-stable.
- Multi-browser matrix (firefox/webkit) once the suite is green on chromium.
