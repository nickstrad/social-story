# Plan 05 — Async Task System (Inngest + polling)

**Depends on:** 01 (Task model, repos, container), 03 (tRPC), 04 (`taskMachine.ts`). **Blocks:** 07, 09, 10, 12.

## Context

Read `docs/00-overview.md`. Every long-running job (parse, base image, page image, PDF) is a `Task` row plus an Inngest event. The UI creates tasks via tRPC mutations (later plans), then polls task status via tRPC. This plan builds the generic machinery; later plans register concrete handlers.

## Deliverables

### 1. Inngest setup

- `npm i inngest`.
- `src/server/inngest/client.ts` — `new Inngest({ id: 'social-story' })`.
- `src/app/api/inngest/route.ts` — `serve({ client, functions: [...allFunctions] })` where `allFunctions` is exported from `src/server/inngest/functions/index.ts` (starts empty; plans 07/09/10/12 append).
- Event naming: `task/dispatch` with payload `{ taskId }` — one generic event; the handler looks up the task row and switches on `task.type`. This keeps later plans additive.
- Dev instructions in the file header: `npx inngest-cli dev` alongside `npm run dev`.

### 2. Task service — `src/server/services/tasks.ts`

Vendor-agnostic API over TaskRepo + a `TaskDispatcher` port:

```ts
// src/server/ports/dispatcher.ts
export interface TaskDispatcher {
  dispatch(taskId: string): Promise<void>
}
```

- Adapter `inngestDispatcher` (sends `task/dispatch`); fake `immediateDispatcher(runner)` for tests that runs the handler inline; add `dispatcher` to `container.ts`.
- `createTask(deps, { userId, storyId, pageId?, type }): Promise<Task>` — inserts PENDING, dispatches, returns row.
- `runTask(deps, taskId, handler)` — the shared execution wrapper used by every Inngest function: load task; use `canTransition` (plan 04) to move PENDING→RUNNING (if not PENDING, exit — idempotency/duplicate-delivery guard); await `handler(task, deps)`; write SUCCEEDED + `resultJson`, or FAILED + `error` message. `startedAt`/`finishedAt` stamped.
- Handler registry — `src/server/inngest/handlers.ts`: `registerTaskHandler(type, handler)` / `getTaskHandler(type)`. One Inngest function `taskDispatchFn` subscribes to `task/dispatch`, resolves the handler by type, calls `runTask`. Concurrency config: cap at 10 per user (Inngest `concurrency` option) mirroring the CLI default.

### 3. tRPC router — `src/server/api/routers/task.ts`

- `task.get({ taskId })` — ownership-checked single task.
- `task.listForStory({ storyId, activeOnly? })` — tasks for a story (for badges + the bulk-generate progress view).
- `task.retry({ taskId })` — only if FAILED: create a **new** task (same type/page), dispatch it.
- Register in `root.ts`.

### 4. Client polling hook — `src/hooks/useTaskPolling.ts`

- `useTask(taskId)` — `trpc.task.get.useQuery` with `refetchInterval` = 1500ms while PENDING/RUNNING, off when terminal. Extract the interval decision as a pure function `pollInterval(status)` and unit-test it.
- `useStoryTasks(storyId)` — same pattern over `listForStory`, returns `summarizeStoryTasks` (plan 04) output plus raw list.
- Dumb component `src/components/tasks/TaskStatusBadge.tsx` (props: `status`, `error?`) — stateless; compose shadcn `Badge` + `Spinner` (running), with the error text in a shadcn `Tooltip`.

## Tests

- Unit: `pollInterval` decisions; `runTask` with in-memory repos + a handler that succeeds / throws / task already RUNNING (asserts states, timestamps, error persisted, no double-run).
- Integration `src/server/__tests__/tasks.int.test.ts`: `createTask` with `immediateDispatcher` wired to a registered dummy handler against the test DB → row goes PENDING→SUCCEEDED with resultJson; `task.retry` on FAILED creates a fresh PENDING task; ownership enforced (other user's task → NOT_FOUND).

## Files created

`src/server/inngest/{client,handlers}.ts`, `src/server/inngest/functions/index.ts`, `src/app/api/inngest/route.ts`, `src/server/ports/dispatcher.ts`, `src/server/services/tasks.ts` (+tests), `src/server/api/routers/task.ts`, `src/hooks/useTaskPolling.ts` (+test), `src/components/tasks/TaskStatusBadge.tsx`.

## Interfaces exposed to other plans

`createTask`, `registerTaskHandler(type, handler)`, `useTask`/`useStoryTasks`, `TaskStatusBadge`.

## Acceptance criteria

- With `inngest-cli dev` running, a manually created dummy task reaches SUCCEEDED and the UI badge updates via polling.
- Tests green; build + lint pass.
