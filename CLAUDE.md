<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# UI styling

Read `docs/styling.md` before changing any CSS, Tailwind class, or UI component.
It defines the three seams: project-wide values live in `src/styles/theme.css`, a
component family's geometry lives in its CVA primitive, and one-off layout stays as
colocated Tailwind. `docs/index.md` maps the rest of `docs/`.

# Worktree workflow

New features go in a new git worktree branched off `main` — never directly on `main` unless explicitly told to. If unsure which applies, ask.

Flow:

1. Create a worktree branched from `main`.
2. Copy `.env.local` into it as-is — do not open or inspect it.
3. Run `npm i`.
4. Do the work.
5. Stop with the completed worktree ready for review. Never merge into `main`
   automatically; merge only after the user gives explicit consent.

Skip the Go CLI (`cli/`) in worktrees — deprecated, kept for reference only.

## Plan → judge → fix workflow

When implementing a plan from `docs/`, use this skill chain instead of working freehand. Each step is triggered manually by the user — never chain into the next step automatically:

1. `/do-next-plan <plan file>` — implements the plan in a new worktree, runs `/simplify`, writes `CHANGE_SUMMARY.md` at the worktree root naming the source plan.
2. `/judge-branch` — runs `scripts/judge-branch.sh`: the `fable` model judges the full worktree diff (committed and uncommitted) against the plan in a fresh `claude -p` context and writes `JUDGEMENT.md` at the worktree root.
3. `/handle-judge-feedback` — implements `JUDGEMENT.md`'s feedback in priority order.

The pipeline stops and asks rather than pushing past blockers it can't resolve (missing `.env.local` values, migrations that can't run, services needing provisioning). Nothing merges to `main` — that's always a separate, explicit action.

# Testing

No test may ever hit a real database, external API, or network — not unit, not integration (`*.int.test.ts`), not anything run by `npm run test:run`. Tests must be fully self-sufficient: use the in-memory repos (`inMemoryRepos`), in-memory storage (`inMemoryStorage`), action-aware `createFakeAiActions` helpers from `src/server/ai/testing/fakes.ts`, and the immediate dispatcher from `src/server/services/fakes.ts`. A "sign-up user" in a test is just a constructed session user passed to `createTestCaller` — never a real Better Auth call. Real Postgres is reserved exclusively for Playwright E2E.

## Server test config env (`vitest.setup.server.ts`)

`src/server/config.ts` validates env at import time (`auth.ts` calls `getConfig()`
at module load), so any server test that transitively imports it needs the config
vars set. Vitest does **not** load `.env.local`, and the suite must never run
against real secrets, so the fake, non-secret values live in `testConfigEnv()` in
`config.ts` (right next to the schema they satisfy) and `vitest.setup.server.ts`
applies them to `process.env` unconditionally — a real `.env` (e.g. one copied
into a worktree) is deliberately overridden. This is why `npm run test:run` is
green in any checkout with no env file at all.

**When you add or change env logic in `config.ts`** — a new required var, or new
branching that reads one (another storage/credential path, etc.) — update
`testConfigEnv()` in the same file and change (add the fake value, or neutralize
the branch as the blob OIDC pair is), or the entire server suite will fail to
import.

Playwright E2E requires Docker and a one-time `npx playwright install chromium`.
Run it with `npm run test:e2e`; the runner owns its disposable Postgres container
and volume and tears them down on every exit. E2E may use that local Postgres,
but OpenAI, Vercel Blob, Inngest, and other external services must remain behind
deterministic fakes. Every new UI flow must include an E2E spec, and every new
external service port must include a deterministic fake.

## E2E must own its own app server (this has been violated before)

The fakes are wired by **environment**, not by the test code: `E2E_FAKES=1`
routes `createDeps` down `createE2eDeps` (`src/server/container.ts`), swapping in
`createE2eAiActions`, `e2eStorage`, and the inline dispatcher. The AI fake
implements every semantic action under `deps.ai`, including deterministic photo
autofill and separate base/page/cover image fixtures. That env lives in `serverEnv` (`e2e/support/constants.ts`) and is
applied **only** to the server Playwright starts itself. A server the suite did
not start has none of it — it holds the real `.env.local`, so the specs drive real
OpenAI, real Vercel Blob, and the dev database.

This actually happened: the harness pointed at `http://localhost:3000` with
`reuseExistingServer: !process.env.CI`. With a `next dev` already on :3000,
Playwright saw the URL answering, skipped its own build, and silently ran the
entire suite against the dev server — real API calls, dev DB writes, and
`E2E_FAKES` never set. It surfaced as task specs hanging on "Complete" (the real
`inngestDispatcher` with no Inngest running never finishes a task), which reads
like a UI bug and sends you chasing the wrong thing.

Rules, therefore:

- E2E runs on its **own port (3100)**, never the dev port. `scripts/e2e.sh`
  aborts if that port is occupied.
- `reuseExistingServer` stays **`false`**. Never re-enable it, and never "fix" a
  port-in-use error by pointing `BASE_URL` at a running server.
- Anything external gets a fake behind a port + `serverEnv` entry. Never a live
  token, not even a read-only one.
- Task specs hanging on "Complete", or an unexplained error toast on a generate
  button, means the app under test is probably not running the fakes. Check
  which process owns the port before debugging the UI.

# AI actions and providers

Read `docs/ai.md` before changing an AI action, prompt, provider adapter,
provider/model configuration, or AI fake. It is the living source of truth and
must be updated in the same change whenever the action catalog, public contracts,
bindings, prompts, or extension workflow changes.

- Product code calls semantic actions through `deps.ai`; it never calls provider
  transports directly or passes arbitrary prompts/schemas through a generic
  text/image model interface.
- Provider code stays inside its adapter directory. Provider settings are read in
  `src/server/config.ts` and selected only in the AI composition root.
- Adding or changing an action/provider requires a deterministic action fake and
  network-free tests, including E2E wiring for every production path.
- AI task changes preserve named workflow/function/step contracts. Durable step
  results never include raw scripts, prompts, photos/data URLs, structured story
  output, or generated bytes.

# .env.local

Never read, `cat`, `grep`, or otherwise inspect `.env.local` (or copies) — it holds secrets. Copy it between worktrees as an opaque file only. To learn which variables are required, read the code (`process.env.X` references) or a checked-in `.env.example`.

The config module (wherever env vars are read in code) is the source of truth for what variables exist and how they're used. Give config values sane defaults where possible, so `.env.local` only carries real secrets and environment-specific overrides. Keeping `.env.local` in sync with the config module is the user's job — don't try to infer or validate its contents.

# Database operations

For manual development or production database work, use the guarded root
`Makefile`/`scripts/db.mjs` interface documented in `docs/database.md`. Always
pass `TARGET=dev` or `TARGET=prod` plus an explicit `DB_URL` or `DB_ENV_FILE`;
never rely on an implicitly loaded env file. Do not inspect an env file while
using it.

Create migrations with `db-migrate` against development only. Apply reviewed,
checked-in migrations with `db-deploy` in production. Database resets require a
matching database-name confirmation, and production reset/push require their
additional explicit opt-in flags. A database reset does not remove Vercel Blob
objects or other external-service data.

To source Production variables from Vercel, use `make vercel-env-pull-prod` to
write the ignored `.env.production` file, then pass it explicitly as
`DB_ENV_FILE=.env.production`. Linking, pulling, and database mutation remain
separate steps. Never inspect or print the pulled file. Use
`vercel-env-pull-prod-force` only when overwriting the local file without a
prompt is intentional.
