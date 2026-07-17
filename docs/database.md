# Database operations

The application uses Prisma with PostgreSQL. Manual database work goes through
the root `Makefile` or `scripts/db.mjs`, which requires both an explicit
environment label and an explicit `DATABASE_URL` source. This reduces the chance
of running a development command against production.

## Supplying the database URL

Choose one source for every command:

```bash
# Paste a URL directly. Quote it so shell metacharacters are not interpreted.
make db-status TARGET=dev DB_URL='postgresql://user:password@host/database'

# Read DATABASE_URL from a dotenv file.
make db-status TARGET=dev DB_ENV_FILE=.env.local

# Call the script directly with either form.
npm run db -- status --target dev --url 'postgresql://user:password@host/database'
npm run db -- status --target dev --env-file .env.local
```

The script never loads `.env` or `.env.local` implicitly. An env file is parsed
as dotenv data, not executed as a shell script, and only its `DATABASE_URL` value
is used. Prefer `DB_ENV_FILE`/`--env-file` so credentials do not remain in shell
history. Env files are ignored by Git; never commit one.

`TARGET=dev` and `TARGET=prod` are safety labels supplied by the operator. They
do not infer or change the URL, so always verify the redacted `host/database`
printed before Prisma runs. Credentials and query parameters are never printed.

## Loading production variables from Vercel

The Vercel CLI must be authenticated and this checkout must be linked to the
correct Vercel project. Link it interactively once, then check the Production
variable inventory:

```bash
make vercel-link
make vercel-env-list-prod
```

Pull the linked project's Production variables into the Git-ignored
`.env.production` file:

```bash
make vercel-env-pull-prod
```

Vercel prompts before overwriting an existing file. When replacing it is
intentional, use the visibly destructive variant:

```bash
make vercel-env-pull-prod-force
```

The force target passes Vercel's `--yes` option and replaces `.env.production`
without an overwrite prompt. Neither target opens, prints, or otherwise inspects
the resulting file. Treat it like `.env.local`: never read it into logs or
commit it.

After pulling, pass the file explicitly to a guarded database command:

```bash
make db-status TARGET=prod DB_ENV_FILE=.env.production
make db-deploy TARGET=prod DB_ENV_FILE=.env.production
```

Pulling variables and applying migrations remain separate commands so the pull
cannot accidentally trigger a production database change. If the checkout is
linked to the wrong Vercel project, run `make vercel-link` and choose the correct
project before pulling again.

## Command reference

| Make target   | Script command | Purpose                                                                               |
| ------------- | -------------- | ------------------------------------------------------------------------------------- |
| `db-status`   | `status`       | Show applied and pending migrations.                                                  |
| `db-deploy`   | `deploy`       | Apply checked-in pending migrations without creating new ones.                        |
| `db-migrate`  | `migrate-dev`  | Create and apply a development migration. Accepts `NAME=...`.                         |
| `db-reset`    | `reset`        | Wipe the target database and replay all migrations.                                   |
| `db-push`     | `push`         | Synchronize the schema without creating a migration.                                  |
| `db-pull`     | `pull`         | Replace the local Prisma schema by introspecting the database.                        |
| `db-studio`   | `studio`       | Open Prisma Studio for the target database.                                           |
| `db-generate` | `generate`     | Regenerate Prisma Client.                                                             |
| `db-validate` | `validate`     | Validate the Prisma schema.                                                           |
| `db-format`   | `format`       | Format the Prisma schema.                                                             |
| `db-test`     | —              | Run the database command wrapper's isolated tests; it does not connect to a database. |

Vercel environment helpers:

| Make target                  | Purpose                                                                 |
| ---------------------------- | ----------------------------------------------------------------------- |
| `vercel-link`                | Interactively link the checkout to a Vercel project.                    |
| `vercel-env-list-prod`       | List Production environment-variable names and metadata.                |
| `vercel-env-pull-prod`       | Pull Production variables into `.env.production`, prompting to replace. |
| `vercel-env-pull-prod-force` | Pull Production variables and replace `.env.production` without asking. |

Run `make help` or `npm run db -- --help` for the complete CLI help.

## Migration workflow

Create migrations only against a disposable development database:

```bash
make db-status TARGET=dev DB_ENV_FILE=.env.local
make db-migrate TARGET=dev DB_ENV_FILE=.env.local NAME=describe_the_change
```

Review the new SQL under `prisma/migrations/`, run the application tests, and
commit the schema and migration together. `migrate-dev` refuses `TARGET=prod`.

Apply checked-in migrations to production with `deploy`:

```bash
make db-status TARGET=prod DB_ENV_FILE=.env.production
make db-deploy TARGET=prod DB_ENV_FILE=.env.production
make db-status TARGET=prod DB_ENV_FILE=.env.production
```

`deploy` never generates a migration or detects schema drift. Do not use
`migrate-dev` or `db-push` as a substitute for a reviewed production migration.

## Resetting a database

Reset destroys all PostgreSQL data in the target database, then replays the
checked-in migrations. The confirmation value must exactly match the database
name in `DATABASE_URL`:

```bash
make db-reset \
  TARGET=dev \
  DB_ENV_FILE=.env.local \
  CONFIRM=database_name
```

A production reset requires a second explicit opt-in:

```bash
make db-reset \
  TARGET=prod \
  DB_ENV_FILE=.env.production \
  CONFIRM=database_name \
  ALLOW_PRODUCTION_RESET=1
```

Use production reset only when destroying that environment is intentional and
recoverability has been verified. Reset affects PostgreSQL only. It does not
delete app-owned Vercel Blob objects or data in any other service.

## Schema push and introspection

`db-push` is useful for temporary development prototyping, but it does not
create migration history:

```bash
make db-push TARGET=dev DB_ENV_FILE=.env.local
```

If Prisma reports possible data loss and that loss is intentional, add
`ACCEPT_DATA_LOSS=1`. Production also requires `ALLOW_PRODUCTION_PUSH=1`; a
reviewed migration plus `db-deploy` is strongly preferred.

`db-pull` rewrites `prisma/schema.prisma` from the target database. Commit or
stash local schema edits before using it, then review the diff immediately:

```bash
make db-pull TARGET=dev DB_ENV_FILE=.env.local
git diff -- prisma/schema.prisma
```

## Tests and the E2E database

Unit and integration tests must never use a real database. `npm run test:run`
uses in-memory repositories and deterministic fakes. Playwright E2E is the only
test suite allowed to use PostgreSQL; `npm run test:e2e` owns its disposable
container, migrations, and teardown. Do not point these manual commands at the
E2E database while its runner is active.

## Troubleshooting

- `--target must be either dev or prod`: pass `TARGET=dev` or `TARGET=prod`.
- `No database source supplied`: pass exactly one of `DB_URL` or
  `DB_ENV_FILE`.
- `Reset requires --confirm ...`: copy the database name shown by the error,
  not the hostname or full URL.
- `migrate-dev is disabled for prod`: create and review the migration in
  development, then use `db-deploy` for production.
- Prisma Client initialization errors after installing dependencies: run
  `make db-generate TARGET=dev DB_ENV_FILE=.env.local`.
