<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

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

No test may ever hit a real database, external API, or network — not unit, not integration (`*.int.test.ts`), not anything run by `npm run test:run`. Tests must be fully self-sufficient: use the in-memory repos (`inMemoryRepos`), in-memory storage (`inMemoryStorage`), and the fake text/image generators and immediate dispatcher from `src/server/services/fakes.ts`. A "sign-up user" in a test is just a constructed session user passed to `createTestCaller` — never a real Better Auth call. Real Postgres is reserved exclusively for Playwright E2E.

Playwright E2E requires Docker and a one-time `npx playwright install chromium`.
Run it with `npm run test:e2e`; the runner owns its disposable Postgres container
and volume and tears them down on every exit. E2E may use that local Postgres,
but OpenAI, Vercel Blob, Inngest, and other external services must remain behind
deterministic fakes. Every new UI flow must include an E2E spec, and every new
external service port must include a deterministic fake.

## E2E must own its own app server (this has been violated before)

The fakes are wired by **environment**, not by the test code: `E2E_FAKES=1`
routes `createDeps` down `createE2eDeps` (`src/server/container.ts`), swapping in
`staticTextGenerator`, `scriptedImageGenerator`, `e2eStorage`, and the inline
dispatcher. That env lives in `serverEnv` (`e2e/support/constants.ts`) and is
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

# .env.local

Never read, `cat`, `grep`, or otherwise inspect `.env.local` (or copies) — it holds secrets. Copy it between worktrees as an opaque file only. To learn which variables are required, read the code (`process.env.X` references) or a checked-in `.env.example`.

The config module (wherever env vars are read in code) is the source of truth for what variables exist and how they're used. Give config values sane defaults where possible, so `.env.local` only carries real secrets and environment-specific overrides. Keeping `.env.local` in sync with the config module is the user's job — don't try to infer or validate its contents.
