I attempted to run the test suite and typecheck to verify the implementer's claims, but command approval was denied, so this judgement is based on the diff alone (the change summary reports 61 tests, typecheck, lint, and build passing).

# Judgement — feature/trpc

Plan: docs/03-trpc.md
Verdict: READY

## Blockers
_none_

## Should-fix

- **Retry button can't recover a failed suspense query** — `src/components/ErrorBoundary.tsx:29` — `reset` only clears the boundary's local state. When the error came from a `useSuspenseQuery` (the primary use case per the plan), React Query still holds the rejected query, so re-rendering re-throws the same error and the retry loops uselessly. Wire in `useQueryErrorResetBoundary` (e.g. via a small `QueryErrorResetBoundary` wrapper or passing an `onReset` that calls the reset callback) so "Try again" actually refetches.
- **`prefetch()` is a no-op that only makes sense with a different call shape than the plan documents** — `src/lib/trpc-server.tsx:31` — the plan's usage is `prefetch(trpc.story.get.queryOptions({ storyId }))`, but the implementation's `prefetch(promise)` just voids whatever it's handed; the real work happens inside `trpc.x.prefetch()` from `createHydrationHelpers`. This is a legitimate "current equivalent" per the plan's own caveat, and the file header documents the corrected pattern — but the header example (`prefetch(trpc.story.get.prefetch(...))`) double-wraps redundantly. Clean the documented pattern to a single call (`void trpc.story.get.prefetch(...)` or make `prefetch` accept and invoke the helper) so plans 07–12 copy a coherent convention.

## Nits

- **File is `trpc-server.tsx`, plan names `trpc-server.ts`** — `src/lib/trpc-server.tsx:1` — no JSX appears in the file, so the `.tsx` extension is unnecessary and deviates from the planned filename that later plans will import by convention. Rename to `.ts` (path-alias imports are unaffected, so this is cosmetic).
- **`createHookWrapper` defaults `fetch` to `globalThis.fetch`** — `src/hooks/test-utils.tsx:11` — the plan intends hook tests to run against a mock fetch/msw; defaulting to the real global fetch invites accidental network calls in tests that forget to pass one. Consider defaulting to a stub that throws with a helpful message.
