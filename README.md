# social-story

Turn a plain-text social story into a personalized, illustrated picture book using OpenAI.

This repo is mid-conversion from a Go CLI to a web app:

- **`cli/`** — the working Go CLI (the current, usable tool).
- **Repo root** — a Next.js 16 scaffold plus a full set of implementation plans in [`docs/`](docs/) for the web version. The web app itself is not built yet.

## The web app (planned)

The planned UX: sign in, paste a social-story script, upload photos of the people who should appear (with metadata and rules like "the siblings always appear together"), generate a character reference sheet for visual consistency, then generate an illustration per page — with editable text, extra steering prompts, regeneration variants, and add/remove/hide/reorder — before exporting the finished book as a PDF. Image generation runs as background tasks so the UI never blocks.

The build is specified as self-contained plans in [`docs/plans/`](docs/plans/): start with [`docs/plans/completed/00-overview.md`](docs/plans/completed/00-overview.md) (architecture, conventions, dependency graph), then plans `01`–`12` in dependency order. Planned stack: Next.js 16 (App Router), tRPC v11, Prisma → Neon Postgres, Better Auth, Vercel Blob, Inngest, sharp, pdf-lib.

Each plan lives in [`docs/plans/open/`](docs/plans/open/) until its work is finished, then moves to [`docs/plans/completed/`](docs/plans/completed/). Once a plan's branch is merged into `main`, delete its worktree and branch — don't leave finished worktrees or branches lying around.

What exists at the root today:

- Next.js 16 + TypeScript + Tailwind CSS 4 scaffold (`src/app/`)
- shadcn/ui component set (`src/components/ui/`)
- Vitest + React Testing Library configured (`vitest.config.mts`, `vitest.setup.ts`)
- Prettier + husky/lint-staged pre-commit hooks

```bash
npm install
npm run dev     # mprocs starts the app and Inngest Dev Server together
npm test        # vitest
```

### Web environment and private assets

Use [`.env.example`](.env.example) as the variable reference. Hosted deployments
should connect a private Vercel Blob store so `BLOB_STORE_ID` and
`VERCEL_OIDC_TOKEN` are available together. Local development can instead set
`BLOB_READ_WRITE_TOKEN` to a private-store token.

This app is pre-production, and the private-asset schema intentionally has no
legacy-URL backfill command. Before applying this feature locally, wipe the
disposable development database and the app-owned `stories/` objects in the old
Blob store, then apply the migrations to the empty database:

```bash
npx prisma migrate reset
```

`npm run dev` uses [`mprocs`](https://github.com/pvolok/mprocs) and
`mprocs.yaml` to run the Next app at http://localhost:3000 and the Inngest UI at
http://localhost:8288 in one terminal. The normal development database is the
configured remote Postgres database, so there is no third long-running local
process; the disposable local Postgres container is only started by
`npm run test:e2e`.

The web app dispatches parsing, image generation, and PDF export through
Inngest. Set `INNGEST_DEV=1` (included in `.env.example`) so the SDK sends
events to the local Dev Server; local development does not need real Inngest
keys. Hosted environments must set `INNGEST_DEV=0` and provide both
`INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` from the matching Inngest
environment.

To run either development process by itself, use `npm run dev:web` or
`npm run dev:inngest`.

## Database operations

Use the root `Makefile` or `npm run db` for explicit database maintenance. These
commands never load `.env` or `.env.local` automatically: identify the target as
`dev` or `prod`, then provide either a URL or a dotenv file containing
`DATABASE_URL`. See [`docs/database.md`](docs/database.md) for the full migration
workflow, command reference, and safety behavior.

```bash
# Inspect a pasted development URL.
make db-status TARGET=dev DB_URL='postgresql://user:password@host/database'

# Apply checked-in migrations to production using a local, untracked env file.
make db-deploy TARGET=prod DB_ENV_FILE=.env.production

# Create and apply a development migration.
make db-migrate TARGET=dev DB_ENV_FILE=.env.local NAME=add_story_index

# Wipe a disposable development database and replay all migrations. The
# confirmation must exactly match the database name in DATABASE_URL.
make db-reset TARGET=dev DB_ENV_FILE=.env.local CONFIRM=database
```

Run `make help` for the full command list. Prefer an env file when possible so
credentials are not retained in shell history.

To populate `.env.production` from the linked Vercel project, authenticate with
the Vercel CLI and run:

```bash
make vercel-link          # one-time project linking
make vercel-env-list-prod
make vercel-env-pull-prod
```

The pull command does not run a database operation. See
[`docs/database.md`](docs/database.md#loading-production-variables-from-vercel)
for overwrite behavior and the production migration workflow.

## End-to-end tests

The Playwright suite runs against a production Next.js build and a disposable
Postgres database. Docker must be running. Install Chromium once after installing
the project dependencies:

```bash
npm install
npx playwright install chromium
```

Run the complete suite with:

```bash
npm run test:e2e
```

The runner starts Postgres, applies migrations, runs the browser tests, and
always removes the container and its volume when it exits. OpenAI, Vercel Blob,
and Inngest are replaced by deterministic local fixtures in E2E mode, so the
suite makes no paid external-service calls.

New UI flows must include a Playwright E2E spec. Any new external service port
must include a deterministic fake suitable for automated tests.

## The Go CLI (working today)

Lives in `cli/`. It parses a story into pages, optionally personalizes illustrations with your own photos, keeps characters consistent via a generated character sheet, captions pages deterministically, and assembles a PDF.

Setup — one OpenAI API key in `cli/.env`:

```
OPENAI_API_KEY=sk-...
```

Build and run:

```bash
cd cli
go build -o social-story .

./social-story parse    example_story.txt story.json   # 1. text -> JSON pages
./social-story base                                    # 2. character-sheet anchor from photos/
./social-story title    story.json images              # 3. cover page (optional)
./social-story generate story.json images --page 1     # 4. test one page
./social-story generate story.json images              # 5. generate all pages
./social-story redo     story.json 2 images            # 6. regenerate page 2 as a variant
./social-story pdf      story.json images              # 7. combine -> final_stories/*.pdf
```

Personalization: put photos in `cli/photos/` with an `index.md` describing each one; the tool attaches at most one fitting photo per page. Commands accept `--chat-model` / `--image-model` overrides (defaults: `gpt-5.6-terra` chat, `gpt-image-2` images; only `gpt-image-*` models support reference photos). See the usage header in `cli/main.go` for the full reference, including `caption` and page-range syntax.
