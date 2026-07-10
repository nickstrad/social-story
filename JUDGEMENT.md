# Judgement — feature/page-generation

Plan: docs/10-page-generation.md
Verdict: READY

## Blockers

_none_

## Should-fix

- **Cover generation ignores `steeringText` semantics but, more importantly, `resultJson: { pageImageId }` is only implied, not verified** — `src/server/inngest/functions/pageImage.ts:113`. The handler returns `{ pageImageId }` and relies on `runTask` to persist it as `resultJson`; no test asserts the succeeded task's `resultJson` actually contains `pageImageId`, though the plan calls it out explicitly. Add an assertion in the integration test that `finished.resultJson` (or equivalent) carries `{ pageImageId }`.

- **`generateBulk` has no active-task guard, so it can race a single `page.generate`** — `src/server/api/routers/page.ts:52`. A bulk request including a page that is already PENDING/RUNNING creates a second concurrent PAGE_IMAGE task for that page — exactly the race `page.generate` refuses ("variants would race"). The plan doesn't mandate the guard and the summary flags the omission as deliberate, but the inconsistency undermines the single-generate guard; skip already-active pages (or filter them out and report which were skipped).

## Nits

- **`page.generate` checks the active-task guard before persisting `steeringText`, reversing the plan's stated order** — `src/server/api/routers/page.ts:26`. Plan says "persists steeringText …, refuses if …, then createTask"; implementation refuses first, so a rejected call silently drops the user's new steering text. Behaviorally defensible, but worth confirming plan 11's UI expects this.

- **No dedicated test for `useBulkGeneration`** — `src/hooks/useBulkGeneration.ts:1`. "Files created" lists `useBulkGeneration.ts (+tests)`; only its pure pieces (`selection.ts`, `summarizeStoryTasks`) are tested. The Tests section names only photoPick/derivePageGenState/selection, so this reads as satisfied in spirit, but the hook's PAGE_IMAGE-only progress filter is untested logic.

- **Cover integration test doesn't verify the anchor-first reference behavior for covers** — `src/server/__tests__/pageImage.int.test.ts:216`. The cover case runs with `baseImageUrl` null, so the "cover counts as peopled → anchor attached" branch is only exercised implicitly via the peopled-page test.

- **Acceptance criteria (build/lint green, manual end-to-end run) are claimed in the summary but could not be independently re-verified in this judgement** — test/build commands were not runnable in this review context; claims taken on the summary's word.
