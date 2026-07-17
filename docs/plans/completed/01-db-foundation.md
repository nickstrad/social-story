# Plan 01 — Database Foundation: Prisma, Schema, Blob Storage

**Depends on:** nothing. **Blocks:** 02, 03, 05, 06, 08. Can run in parallel with 04.

## Context

Repo is a fresh Next.js 16 (App Router) app at root; `src/app/` has only the scaffold. `.env` at root already contains `DATABASE_URL` (Neon Postgres), `OPENAI_TOKEN` (OpenAI key), and will contain `BLOB_READ_WRITE_TOKEN` (Vercel Blob). Read `docs/00-overview.md` for full conventions. **Before writing Next.js code, read the relevant guide under `node_modules/next/dist/docs/`.**

## Deliverables

### 1. Install & configure Prisma

- `npm i prisma @prisma/client && npx prisma init` (keep `.env` untouched — prisma init must not overwrite it; if it would, skip init and hand-create `prisma/schema.prisma`).
- Datasource: postgres via `DATABASE_URL`. Generator: `prisma-client-js`.
- Scripts in `package.json`: `"db:migrate": "prisma migrate dev"`, `"db:push": "prisma db push"`, `"db:generate": "prisma generate"`.

### 2. Full schema — `prisma/schema.prisma`

Define ALL models now so later plans never migrate concurrently:

**Better Auth tables** (`User`, `Session`, `Account`, `Verification`) — use the canonical Better Auth Prisma models (check `better-auth` docs for exact field names; plan 02 will run `npx @better-auth/cli generate` to verify — match that output). `User` needs `id`, `name`, `email @unique`, `emailVerified`, `image?`, timestamps.

**App models** (all with `id String @id @default(cuid())`, `createdAt`, `updatedAt`):

```
Story:      userId → User; title String; script String (raw pasted text);
            status StoryStatus (DRAFT|PARSED|READY); baseImageUrl String?;
            coverNote String? (extra art direction for cover)
Character:  storyId → Story; name; role String? ("dad", "little brother");
            age String?; appearance String? (free text: hair, skin tone, etc.);
            photoUrl String? (blob URL); photoDescription String? (what the photo shows)
Rule:       storyId → Story; text String (free-text rule, e.g. "Allison and Ezra
            always appear together"); kind RuleKind (TOGETHER|ALWAYS_INCLUDE|NEVER_INCLUDE|FREEFORM);
            characterIds String[] (subject characters, for structured kinds)
Page:       storyId → Story; kind PageKind (COVER|PAGE); position Int (order, cover=0);
            text String; imagePrompt String; characterIds String[];
            steeringText String? (user's extra prompt info);
            hidden Boolean @default(false);
            selectedImageId String? (FK to PageImage, the accepted variant)
PageImage:  pageId → Page; url String (blob URL of FINAL captioned image);
            rawUrl String? (pre-caption image); promptUsed String; variant Int
Task:       userId → User; storyId → Story; pageId String?;
            type TaskType (PARSE_STORY|BASE_IMAGE|PAGE_IMAGE|PDF_EXPORT);
            status TaskStatus (PENDING|RUNNING|SUCCEEDED|FAILED);
            error String?; resultJson Json? (e.g. {pageImageId} or {pdfUrl});
            startedAt DateTime?; finishedAt DateTime?
```

Relations get `onDelete: Cascade` from Story downward. Index `Task(storyId, status)`, `Page(storyId, position)`, `PageImage(pageId, variant)`.

Run `npx prisma migrate dev --name init` against the real DB.

### 3. Typed env config — `src/server/config.ts`

Single zod-validated source of all environment configuration; **nothing else in the app reads `process.env`** (only adapter constructors receive values from here via the container).

```ts
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  OPENAI_TOKEN: z.string().min(1),
  BLOB_READ_WRITE_TOKEN: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().url(),
  OPENAI_CHAT_MODEL: z.string().default("gpt-5.5"),
  OPENAI_IMAGE_MODEL: z.string().default("gpt-image-2"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
})
```

- Export `getConfig()`: parses `process.env` once (memoized) and returns a structured, readonly object grouped by concern — `{ db: { url }, openai: { token, chatModel, imageModel }, blob: { token }, auth: { secret, url }, env }` — so call sites depend on shape, not env var names. On validation failure, throw at startup with the flattened zod error listing every missing/invalid key (fail fast, all problems at once).
- Extract the pure part as `parseConfig(env: Record<string, string | undefined>)` (takes any dict, returns the config object or throws) so it's unit-testable without touching real env; `getConfig()` is just `parseConfig(process.env)` memoized.
- Test-friendly: integration tests can build fake configs via `parseConfig({...})`.
- `container.ts` calls `getConfig()` and passes the relevant slices into each adapter constructor. Later plans (02 auth, 06 OpenAI) consume their keys from here — they must NOT read `process.env` directly. New env keys added by later plans are added to this schema (and `.env.example`).

Add `src/server/config.test.ts`: missing required key → throws naming it; defaults applied; multiple errors reported together.

### 4. Prisma client singleton — `src/server/db.ts`

Standard `globalThis`-cached `PrismaClient` export (`db`).

### 5. Blob storage port + adapter

- `npm i @vercel/blob`.
- Port in `src/server/ports/storage.ts` (interface only, vendor-free); adapter in `src/server/services/vercel-blob-storage.ts`:
  ```ts
  export interface Storage {
    put(
      key: string,
      data: Buffer | ReadableStream,
      contentType: string
    ): Promise<{ url: string }>
    fetchBuffer(url: string): Promise<Buffer> // download a blob back for compositing/PDF
    delete(url: string): Promise<void>
  }
  ```
- `vercelBlobStorage: Storage` implementation using `put`/`del` from `@vercel/blob` (`access: 'public'`, `addRandomSuffix: true`) and plain `fetch` for `fetchBuffer`.
- `inMemoryStorage(): Storage` fake (Map-backed, returns `mem://` URLs) exported for tests.
- Key convention (document in file): `stories/{storyId}/photos/{characterId}.png`, `stories/{storyId}/base.png`, `stories/{storyId}/pages/{pageId}/v{n}.png`, `stories/{storyId}/story.pdf`.

### 6. Repository ports + Prisma adapters

DB access is also behind interfaces so persistence can be swapped. In `src/server/ports/repos.ts` define one interface per aggregate — `StoryRepo`, `CharacterRepo`, `RuleRepo`, `PageRepo`, `TaskRepo` — whose methods accept/return **domain types** (plain object types in `src/server/domain/types.ts`, mirroring the schema fields), never Prisma-generated types or clients. Keep methods need-driven (e.g. `PageRepo.listByStory(storyId)`, `PageRepo.updateOrder(storyId, orderedIds)`), not generic CRUD. Implement Prisma adapters in `src/server/repos/prisma/*.ts` (thin mapping) and `inMemoryRepos()` fakes in `src/server/repos/memory.ts` for unit tests. Later plans add methods to these interfaces as needed. Create the composition root `src/server/container.ts` exporting `getDeps(): { storage, repos, ... }` (text/image generators are added in plan 06).

### 7. Test setup adjustments (Vitest already configured)

`vitest.config.ts` + `vitest.setup.ts` (jsdom default, RTL/jest-dom) already exist — **do not re-scaffold**. Make two additions only:

- Server tests need node: add `environmentMatchGlobs: [['src/server/**', 'node']]` to `vitest.config.ts` (keeps jsdom for hooks/components).
- Add `"test:run": "vitest run"` to `package.json` (the existing `"test"` is watch mode); acceptance checks use `npm run test:run`.
- `src/server/services/storage.test.ts`: unit tests for `inMemoryStorage` (put/fetch/delete roundtrip) and for the key-builder helpers (export small pure functions `photoKey(storyId, characterId)` etc. and test them).
- `src/server/__tests__/db.int.test.ts`: integration test that connects with `db`, creates a Story with nested Pages, reads it back, cascades delete. Guard with `describe.skipIf(!process.env.DATABASE_URL)`.

Also update the storage test paths: unit tests cover `inMemoryStorage`, key builders, and `inMemoryRepos` roundtrips; the db integration test exercises the Prisma repo adapters (not raw `db`) so mapping is verified.

## Files created

`prisma/schema.prisma`, `prisma/migrations/*`, `src/server/config.ts` (+test), `src/server/db.ts`, `src/server/ports/storage.ts`, `src/server/ports/repos.ts`, `src/server/domain/types.ts`, `src/server/services/vercel-blob-storage.ts`, `src/server/services/memory-storage.ts`, `src/server/repos/prisma/*.ts`, `src/server/repos/memory.ts`, `src/server/container.ts` (+ tests); edits to `vitest.config.ts` and `package.json`.

## Acceptance criteria

- `npx prisma migrate dev` applied cleanly; `npx prisma studio` shows all tables.
- `npm run test:run` green (storage unit tests + db integration test).
- `npm run build` and lint pass.
