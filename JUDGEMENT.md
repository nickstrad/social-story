# Judgement — feature/task-system

Plan: docs/05-task-system.md
Verdict: READY

## Blockers
_none_

## Should-fix

**`runTask` bypasses the plan's `canTransition` guard** — src/server/services/tasks.ts:31
The plan specifies that `runTask` should "use `canTransition` (plan 04) to move PENDING→RUNNING". The implementation instead introduces a new `claimPending` repo method (src/server/ports/repos.ts:59) that hard-codes the PENDING→RUNNING check in each repo adapter, leaving `taskMachine.canTransition` unused for this transition. The atomic claim is a genuine improvement over a read-then-write guard (it closes the duplicate-delivery race, and the test at src/server/services/tasks.test.ts:74 proves it), but the state-machine rule now lives in two repo implementations instead of the single domain function plan 04 built for it. Resolve by having `claimPending` implementations (or `runTask`) consult `canTransition`, or by documenting in the code that the repo method is the intentional replacement for the domain guard — and confirming plan 04's owner is fine with the transition rules being duplicated.

## Nits

**Event payload extends the plan's `{ taskId }` contract** — src/server/inngest/dispatcher.ts:11
The plan defines the `task/dispatch` payload as `{ taskId }`; the dispatcher sends `{ taskId, userId }`. The extra field is necessary for the per-user `concurrency` key on `taskDispatchFn` and is disclosed in the change summary, but the plan doc should be updated so later plans (07/09/10/12) emit the same shape — a task dispatched without `userId` would silently escape the per-user cap.

**`immediateDispatcher` ships in production code path** — src/server/ports/dispatcher.ts:5
The plan describes `immediateDispatcher(runner)` as a fake for tests, but it lives in the ports module imported by production code. Harmless (it's a two-line wrapper), just slightly blurs the port/fake boundary; a `test-utils` or `fakes` home would match the repo's existing convention (`src/server/services/fakes`).

**Missing-handler fallback is unplanned behavior** — src/server/inngest/functions/index.ts:10
Failing a task whose type has no registered handler (rather than exiting and leaving it PENDING) is an out-of-scope addition, though a sensible and tested one (src/server/inngest/functions/index.test.ts:24). Worth confirming plans 07/09/10/12 register handlers at module load before the Inngest route serves traffic, since a registration race would now permanently FAIL the task instead of retrying.
