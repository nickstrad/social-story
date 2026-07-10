# Social Story Web App — Master Plan & Conventions

This directory contains a sequence of self-contained implementation plans (`01-*.md` … `12-*.md`). Each plan can be handed to a separate coding agent. **Read this file before executing any plan.** The dependency graph at the bottom says which plans can run in parallel.

## What we are building

A web app version of the Go CLI in `cli/` (read `cli/main.go` for reference behavior). A user:

1. Signs up / logs in (Better Auth, email + password).
2. Creates a **Story** by pasting a high-level social-story script.
3. The platform parses the script (OpenAI chat model, structured output) into ~20 pages, each with `text`, `imagePrompt`, and `characters[]`.
4. The user uploads **character photos**, adds metadata per character (name, role, age, appearance description) and **rules** (e.g. "all siblings must appear together in a picture").
5. The platform generates a **base image** (character reference sheet) from the photos — the consistency anchor attached to every subsequent page image.
6. Page-by-page flow: for each page (cover + content pages) the user can edit the text, add extra steering text, pick which characters appear, then generate the image. The caption (page text band) is composited deterministically server-side. The user can **regenerate** (keeping variants) or move on.
7. Alternatively, the user selects/deselects any subset of pages (or all, cover included) and lets the platform generate them best-effort in bulk.
8. Pages can be added / removed / hidden / reordered.
9. When done, the user generates a **PDF** (cover first, then visible pages in order) and downloads it.

**Image generation is asynchronous**: every generation is a **Task** processed in the background via **Inngest**; the UI never blocks — it polls task status via tRPC.

## Stack (fixed decisions — do not relitigate)

- **Next.js 16 (App Router)** — already scaffolded at repo root. ⚠️ This Next.js version has breaking changes vs. training data. **Before writing any Next.js code, read the relevant guide under `node_modules/next/dist/docs/`** (per `AGENTS.md`).
- **TypeScript, strict.**
- **Prisma** → Neon Postgres. `.env` at repo root has `DATABASE_URL`. Never print or commit env values.
- **Better Auth** for email/password auth.
- **tRPC v11** for the entire API layer (typed end-to-end) with `@tanstack/react-query` on the client. All client↔server data flows through tRPC except: auth routes, the Inngest webhook route, and file upload/serving routes (binary).
- **Vercel Blob** (`@vercel/blob`) for all binary storage (photos, generated images, PDFs), behind a small `storage` service interface. Requires `BLOB_READ_WRITE_TOKEN` in `.env`.
- **Inngest** for async/background work (image generation, parsing, PDF). Local dev uses `npx inngest-cli dev`. If Inngest becomes a blocker, the Task schema and domain logic (plan 05) are transport-agnostic — a plain in-process runner can substitute without schema changes.
- **Zod** for all input validation and OpenAI structured-output schemas.
- **OpenAI** REST API (chat completions with `json_schema` response format; `images/generations` and `images/edits`). **API key env var is `OPENAPI_TOKEN`** (already in `.env` — note the nonstandard name, do not rename). Default models: chat `gpt-5.5`, image `gpt-image-2`, env-overridable via `OPENAI_CHAT_MODEL` / `OPENAI_IMAGE_MODEL`.
- **sharp** for server-side image compositing (caption bands, PNG handling).
- **pdf-lib** for PDF assembly.
- **shadcn/ui** — **already installed**: the full component set lives in `src/components/ui/*` (style `base-nova`, lucide icons, `cn()` in `src/lib/utils.ts`, toasts via `sonner`, aliases `@/components`, `@/hooks`, `@/lib`). Build all UI from these primitives (Button, Card, Input, Textarea, Checkbox, Dialog, Tabs, Badge, Progress, Spinner, Skeleton, Select, Sheet, Tooltip, …); do not hand-roll equivalents or add another component library. Missing components: `npx shadcn add <name>`.
- **Vitest + React Testing Library — already configured**: `vitest.config.ts` (jsdom default, `@vitejs/plugin-react`, tsconfig paths) and `vitest.setup.ts` (`@testing-library/jest-dom/vitest`). Do not re-scaffold. Server/domain test files must opt into node with a `// @vitest-environment node` pragma (or add an `environmentMatchGlobs` entry for `src/server/**` — do this once in plan 01). `npm test` runs vitest in watch mode; add a `"test:run": "vitest run"` script (plan 01) and use it for CI/acceptance checks.
- **Prettier + husky/lint-staged** are set up — don't fight formatting; run `npm run format` if needed.

## Architecture conventions (apply in every plan)

### Ports & adapters (swappable providers)

All external capabilities sit behind **provider-agnostic interfaces ("ports")** defined in `src/server/ports/` as plain TypeScript types with no vendor concepts in their signatures. First implementations are adapters; swapping providers must never touch domain code, routers, or tasks — only DI wiring.

```ts
// src/server/ports/text.ts — LLM calls (impl #1: OpenAI chat completions)
interface TextGenerator {
  generateJson<T>(args: {
    system: string
    user: string
    schema: ZodType<T>
  }): Promise<T>
}
// src/server/ports/image.ts — image gen (impl #1: OpenAI images API)
interface ImageGenerator {
  generate(args: {
    prompt: string
    referenceImages?: { data: Buffer; mimeType: string }[]
    width: number
    height: number
  }): Promise<Buffer> // PNG bytes
}
// src/server/ports/storage.ts — blobs (impl #1: Vercel Blob)
interface Storage {
  put(key, data, contentType): Promise<{ url }>
  fetchBuffer(url): Promise<Buffer>
  delete(url): Promise<void>
}
// src/server/ports/repos.ts — DB access (impl #1: Prisma). One repo per aggregate:
// StoryRepo, CharacterRepo, RuleRepo, PageRepo, TaskRepo — methods speak domain
// types (plain objects from src/server/domain/types.ts), never Prisma types.
```

(Signatures above are illustrative; plans 01 and 06 are authoritative if they differ.) Rules for ports: parameters and return types are plain data / domain types (Buffers, strings, zod schemas) — no model names, no Prisma clients, no `@vercel/blob` options in signatures. Vendor knobs (model id, retries, blob access) are constructor/config concerns of the adapter. Every port ships an in-memory/fake implementation for tests. A single composition root `src/server/container.ts` wires real adapters and exposes `getDeps()`; routers and Inngest functions take deps from it (and tests inject fakes).

### Server

- **Centralized typed config**: `src/server/config.ts` (plan 01) zod-validates all env vars at startup (fail fast, every missing key reported) and exposes a memoized, readonly `getConfig()` object grouped by concern (`openai`, `blob`, `auth`, `db`). **Nothing else reads `process.env`** — adapters receive config slices from the container; new env keys go into this schema plus `.env.example`.

- **Business logic is framework-free.** Domain logic lives in `src/server/domain/**` as **pure functions** on plain data — no Prisma, no fetch, no Next.js imports. Examples: prompt builders, rules engine, page ops, task state machine, PDF page ordering.
- **Adapters/services** in `src/server/services/**` — OpenAI client, blob storage, caption compositor, PDF assembler. They do I/O and call domain functions. Each exposes an interface so tests can inject fakes.
- **tRPC routers** in `src/server/api/routers/**` are thin: Zod-validate, check auth/ownership, call services/domain, return.
- **DB access** goes through the repo ports (`ctx.deps.repos.*`); the singleton Prisma client in `src/server/db.ts` is imported ONLY by the Prisma repo adapters in `src/server/repos/prisma/`. Every user-owned entity carries `userId`; ownership is enforced via a shared helper (plan 03).

### UI: dumb components + hooks

- **Medium/complex components are stateless ("dumb")**: props in, JSX out, callbacks up. No `useState`/`useEffect`/tRPC calls inside them. They live in `src/components/**` (feature folders, NOT inside `src/components/ui/` — that folder is shadcn's) and compose shadcn primitives for all styling.
- **All state and data-fetching lives in custom hooks** in `src/hooks/**` (e.g. `usePageEditor`, `useCharacterForm`, `useTaskPolling`). Hooks compose smaller hooks and pure helper functions (`src/lib/**`) so logic is testable without rendering UI. Page components (`src/app/**/page.tsx`) just wire hook output into dumb components.
- Test hooks with `renderHook` + a tRPC/react-query test wrapper; test extracted pure helpers directly.

### Suspense + RSC prefetch/hydration (performance)

Every data-backed route follows the same pattern (helpers built in plan 03; verify current API in `node_modules/next/dist/docs/` and tRPC's RSC docs):

- The `page.tsx` is a **server component** that calls `prefetch(...)` for the queries its client subtree needs (e.g. `story.get`), then renders `<HydrateClient>` around a client component wrapped in `<Suspense fallback={...}>`. Data streams with the HTML; the client picks it up from the hydrated react-query cache — no client-side loading waterfall on first paint.
- Client hooks read those queries with **`useSuspenseQuery`** (tRPC's suspense variants) so components never branch on `isLoading` for initial data; Suspense fallbacks are shadcn `Skeleton` layouts that match the real component's shape (define one per major screen, colocated with the screen's dumb components).
- **Skeletons beyond first load:** any UI region waiting on async work also shows a shape-matched `Skeleton` rather than a spinner-only state — image areas while a generation task is PENDING/RUNNING, thumbnails while a blob image is downloading (swap on `onLoad`), lists during optimistic refetches where content shape is known. Spinners are reserved for small inline affordances (buttons, badges).
- Wrap Suspense boundaries with an error boundary (one shared `src/components/ErrorBoundary.tsx`, shadcn `Alert` + retry) at the route level.
- **Exception — polling**: task-status queries (`useTask`, `useStoryTasks`) stay plain `useQuery` with `refetchInterval`; do not suspend on data that changes every 1.5s.
- Mutations invalidate as usual; only the _initial_ read path goes through prefetch + suspense.

### Tests

- Every domain module gets colocated unit tests (`*.test.ts`).
- Integration tests (Vitest, real Postgres via `DATABASE_URL` with a dedicated test schema, faked OpenAI/blob/Inngest) live in `src/server/__tests__/`. Each plan names its required integration tests.

## Data model summary (defined fully in plan 01)

Better Auth tables (`User`, `Session`, `Account`, `Verification`) — `Story` — `Character` (metadata + photo blob URL) — `Rule` — `Page` (ordered, hideable; `kind: COVER | PAGE`) — `PageImage` (variants; one marked selected) — `Task` (`type: PARSE_STORY | BASE_IMAGE | PAGE_IMAGE | PDF_EXPORT`, status machine `PENDING → RUNNING → SUCCEEDED | FAILED`).

## Plan index and dependency graph

| #   | File                     | Delivers                                                                            | Depends on                           |
| --- | ------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------ |
| 01  | `01-db-foundation.md`    | Prisma setup, full schema, migrations, ports (storage/repos), adapters, container   | —                                    |
| 02  | `02-auth.md`             | Better Auth email/password, sign-in/up pages, session helpers                       | 01                                   |
| 03  | `03-trpc.md`             | tRPC server/client wiring, protected procedures, ownership helper, hook test utils  | 01, 02                               |
| 04  | `04-domain-core.md`      | Pure domain modules: prompts, rules engine, page ops, zod schemas + unit tests      | — (pure TS, no deps)                 |
| 05  | `05-task-system.md`      | Task state machine, Inngest setup, tRPC task polling, `useTaskPolling` hook         | 01, 03, 04                           |
| 06  | `06-openai-service.md`   | OpenAI adapter (chat + images, retries), caption compositor (sharp)                 | 04 (prompts), 01 (storage)           |
| 07  | `07-story-parse-flow.md` | Story CRUD, script → pages parse task, script-entry UI                              | 03, 04, 05, 06                       |
| 08  | `08-characters-rules.md` | Character/photo upload, metadata, rules CRUD + UI                                   | 01, 03, 04                           |
| 09  | `09-base-image.md`       | Character-sheet base image task + UI step                                           | 05, 06, 08                           |
| 10  | `10-page-generation.md`  | Per-page + bulk generation tasks, steering text, variants, cover                    | 05, 06, 07, 08 (09 for anchor, soft) |
| 11  | `11-page-editor-ui.md`   | Page editor UI: select/deselect, edit, add/remove/hide/reorder, generate/regenerate | 07, 10                               |
| 12  | `12-pdf-export.md`       | PDF assembly task, download UI, end-to-end integration test                         | 05, 10, 11                           |

**Parallelizable waves:**

- **Wave A:** 01 and 04 (fully independent of each other).
- **Wave B:** 02 (after 01); 06 (after 01+04).
- **Wave C:** 03 (after 02); 08 partially (schema exists after 01; router needs 03).
- **Wave D:** 05, then 07 and 09 in parallel; 10 after 07.
- **Wave E:** 11, then 12.

Each plan lists the exact files it creates and the files from other plans it imports, so agents can stub interfaces when working ahead.

Each plan ends with **Acceptance criteria**; a plan is done only when they pass: `npm run test:run`, `npm run build`, lint clean.
