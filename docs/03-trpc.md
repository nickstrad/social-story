# Plan 03 — tRPC Wiring

**Depends on:** 01 (db), 02 (`getServerSession`). **Blocks:** 05, 07, 08.

## Context

Read `docs/00-overview.md`. All app data flows through tRPC v11 + react-query. **Read `node_modules/next/dist/docs/` for route handlers and RSC conventions first.**

## Deliverables

### 1. Install

`npm i @trpc/server @trpc/client @trpc/react-query @tanstack/react-query zod superjson`

### 2. Server core — `src/server/api/trpc.ts`

- `createTRPCContext({ headers })` → `{ deps: getDeps(), session: await getServerSession(headers) }` where `deps` comes from `src/server/container.ts` (plan 01). Routers use `ctx.deps.repos.*` / `ctx.deps.storage` — never Prisma directly — so tests can inject in-memory implementations.
- `initTRPC.context<Context>().create({ transformer: superjson, errorFormatter })` (include zod flatten in errors).
- `publicProcedure`; `protectedProcedure` (throws `UNAUTHORIZED` without session, narrows `ctx.session.user`).
- **Ownership helper** — `src/server/api/ownership.ts`:
  ```ts
  assertStoryOwnership(repos, storyId, userId): Promise<Story>  // throws NOT_FOUND
  assertPageOwnership(repos, pageId, userId): Promise<Page>     // via story.userId
  ```
  Takes the repo interfaces (not Prisma). Every story-scoped router in later plans MUST use these. Unit-test with `inMemoryRepos()`.

### 3. Root router — `src/server/api/root.ts`

`appRouter = createTRPCRouter({ health: publicProcedure.query(() => 'ok') })`. Later plans append routers (`story`, `character`, `rule`, `page`, `task`, `pdf`) here — keep one line per router so merges are trivial. Export `type AppRouter`.

### 4. Route handler — `src/app/api/trpc/[trpc]/route.ts`

`fetchRequestHandler` for GET+POST.

### 5. Client — `src/lib/trpc.ts` + provider

- `createTRPCReact<AppRouter>()` export as `trpc`.
- `src/components/providers/TRPCProvider.tsx` (client component): QueryClient + trpc client (httpBatchLink, superjson). Mounted in root layout.

### 6. RSC prefetch + hydration helpers — `src/lib/trpc-server.ts`

Server-side complement to the react client, per the overview's Suspense convention (check tRPC v11 RSC docs — `createHydrationHelpers` from `@trpc/react-query/rsc` or current equivalent):

- Export `{ trpc: serverCaller, HydrateClient, prefetch }` backed by a per-request `createTRPCContext` (React `cache()`-memoized) and a shared `createQueryClient` factory (`src/lib/query-client.ts`, tuned `staleTime` so hydrated data isn't instantly refetched; used by both `TRPCProvider` and the RSC helpers).
- Usage pattern (documented in the file header, used by plans 07–12):
  ```tsx
  // page.tsx (server component)
  prefetch(trpc.story.get.queryOptions({ storyId }))
  return (
    <HydrateClient>
      <Suspense fallback={<StorySkeleton />}>
        <StoryScreen storyId={storyId} />
      </Suspense>
    </HydrateClient>
  )
  ```
- Shared `src/components/ErrorBoundary.tsx` (shadcn `Alert` + retry button) for wrapping route-level Suspense boundaries.
- Client hooks use `useSuspenseQuery` for initial reads; polling queries (tasks) stay plain `useQuery`.

### 7. Test utilities (used by all later plans)

- `src/server/api/test-utils.ts`: `createTestCaller({ user, deps })` (defaults `deps` to `inMemoryRepos()` + `inMemoryStorage()`) — builds a server-side caller (`appRouter.createCaller`) with an injected session/db so router integration tests don't need HTTP.
- `src/hooks/test-utils.tsx`: `createHookWrapper()` — QueryClient + tRPC provider pointed at a mock fetch (or msw) for `renderHook` tests. Must include a `<Suspense>` boundary in the wrapper so hooks using `useSuspenseQuery` are testable (assert via `waitFor` after the fallback resolves).

## Tests

- `src/server/api/ownership.test.ts` — unit: fake db; owned → returns row; other user / missing → NOT_FOUND.
- `src/server/__tests__/trpc.int.test.ts` — caller with no session hitting a protected proc → UNAUTHORIZED; with session → ok. (Add a trivial `me: protectedProcedure.query(({ctx}) => ctx.session.user)` to support this.)

## Files created

`src/server/api/trpc.ts`, `src/server/api/ownership.ts` (+test), `src/server/api/root.ts`, `src/server/api/test-utils.ts`, `src/app/api/trpc/[trpc]/route.ts`, `src/lib/trpc.ts`, `src/lib/trpc-server.ts`, `src/lib/query-client.ts`, `src/components/providers/TRPCProvider.tsx`, `src/components/ErrorBoundary.tsx`, `src/hooks/test-utils.tsx`, edit `src/app/layout.tsx`.

## Interfaces exposed to other plans

`protectedProcedure`, `createTRPCRouter`, `assertStoryOwnership`/`assertPageOwnership`, `trpc` react client, `prefetch`/`HydrateClient` RSC helpers, `ErrorBoundary`, `createTestCaller`, `createHookWrapper`.

## Acceptance criteria

- `trpc.health.useQuery()` works from a page in dev.
- Tests green; build + lint pass.
