# Judgement — feature/db-foundation

Plan: docs/01-db-foundation.md
Verdict: READY

## Blockers

_none_

## Should-fix

- **`db.int.test.ts` guard doesn't cover module-level Prisma instantiation** — `src/server/__tests__/db.int.test.ts:8` / `src/server/db.ts:5`. The plan's `describe.skipIf(!process.env.DATABASE_URL)` guard only skips the test bodies, but `import { db } from "../db"` unconditionally constructs `PrismaClient` and `prismaRepos(db)` runs at describe-setup time regardless of the guard. With no `DATABASE_URL` set, whether the file loads cleanly depends on Prisma's lazy env resolution rather than on the guard the plan asked for. Resolve by lazily creating the client/repos inside the guarded tests (or a `beforeAll`), so a missing `DATABASE_URL` machine provably skips instead of possibly erroring at import.

## Nits

- **`prisma` CLI shipped as a runtime dependency** — `package.json:42`. The `prisma` package (migrate/generate CLI) is in `dependencies`; only `@prisma/client` is needed at runtime. Move `prisma` to `devDependencies` to keep the production install slim.
- **`environmentMatchGlobs` requirement replaced by per-file pragmas** — plan §7 vs. unmodified `vitest.config.ts`. Justified (Vitest 4 removed the option) and documented in the change summary, but it's now a convention each future server test file must remember (`// @vitest-environment node`), rather than a config-enforced rule. Consider Vitest 4's `test.projects` (workspace-style env split) to restore config-level enforcement.
- **Adapter export shape differs from plan** — `src/server/services/vercel-blob-storage.ts:5`. Plan names a `vercelBlobStorage: Storage` export; the code exports `createVercelBlobStorage(token)`. The factory is arguably better (token injected via container per plan §3), so no change needed — noting only as a spec deviation.
- **`container.test.ts` doesn't exercise `getDeps()`** — `src/server/container.test.ts:9`. The test only verifies the `Deps` shape with in-memory fakes; `getDeps()` itself (config → adapters wiring) is never called, understandable since it needs real env, but a `parseConfig`-driven variant of the factory would make the composition root testable.
