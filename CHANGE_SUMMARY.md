# Change summary — feature/task-system

Plan: docs/05-task-system.md

## What was implemented

- Added Inngest client, Next.js webhook route, generic `task/dispatch` function, per-user concurrency limit, handler registry, and task dispatcher adapters.
- Added vendor-agnostic task creation and execution services with transition guards, timestamps, results, and persisted failures.
- Added ownership-checked tRPC task get/list/retry procedures and registered the task router.
- Added polling hooks, the pure polling interval helper and tests, and a stateless shadcn task status badge.
- Added unit coverage for task execution and a real-Prisma integration suite for inline dispatch, retry, and ownership.
- Added an atomic `claimPending` repository operation so duplicate deliveries cannot run the same task twice.
- Missing registered handlers now transition tasks to FAILED with a persisted error instead of leaving them PENDING.
- `runTask` validates PENDING→RUNNING through the domain state machine before using the repository's atomic compare-and-set claim.

## What /simplify changed

- Removed the duplicate task-handler type by sharing the service type with the handler registry.
- Reused `pollInterval` when deciding whether story task polling should continue.
- Kept conditional task claiming in the repository abstraction and moved the Inngest dispatcher adapter out of the composition root.
- Moved the test-only immediate dispatcher into the existing service fakes module.

## Notes for review

- `npx tsc --noEmit`, ESLint, the production build, and the full test suite pass (25 files, 74 tests), including all three task integration cases against the configured database.
- Inngest 4.12.0 required npm legacy peer resolution because its optional SvelteKit peer dependency conflicts with this project's Vite 8 test tooling.
- The dispatch event includes `userId` alongside `taskId` solely to support Inngest's per-user concurrency key; task resolution and execution still use `taskId`.
- Updated the source plan to document the event payload and module-load handler registration contract for downstream plans.
