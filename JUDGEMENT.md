# Judgement — feature/page-editor-ui

Plan: docs/11-page-editor-ui.md
Verdict: READY

## Blockers

_none_

## Should-fix

- **First-generation focus editor shows the "No image yet" placeholder instead of a skeleton** — `src/components/pages/PageFocusEditor.tsx:24-31`. `MainImage` only renders the `Skeleton` when `busy && url`; when a page is generating its _first_ image (`busy && !url`) it falls through to the dashed "No image yet — generate one to get started" placeholder, which both contradicts the plan ("full-size `Skeleton` while generating") and actively misleads ("generate one" while a generation is already running). Resolve by rendering the skeleton whenever `busy`, regardless of `url`.

- **Pending debounced save is silently discarded on unmount** — `src/hooks/usePageForm.ts:28`. The unmount effect runs `clearTimeout(timer.current)`, so an edit made within 600ms of pressing Prev/Next, "Back to grid", or deleting focus (the `FocusEditor` is keyed on `page.id` and remounts) is lost without any warning, despite the hook exposing a `dirty` flag nobody checks at navigation time. Resolve by flushing the pending update on unmount (fire `update.mutate` with the latest snapshot in the cleanup) or by gating navigation on `dirty`.

- **`page.update` deviates from the plan's persistence rule** — `src/server/api/routers/page.ts:131-146`. The plan says characterIds have "rules applied via `applyRulesToPage` before save"; the implementation persists the raw selection and only returns the expanded list. The deviation is deliberate, documented in CHANGE_SUMMARY.md, covered by the integration test, and arguably better (the "added by rule" badges in `PageMetaForm` depend on raw persistence, and generation re-applies rules) — but it changes what downstream consumers of `page.characterIds` see, so it needs explicit sign-off from the plan owner rather than silent acceptance. Resolve by confirming the deviation (and noting it in the plan/docs) or reverting to expand-before-save.

## Nits

- **`page.add` doesn't validate `afterPageId`** — `src/server/api/routers/page.ts:167-172`. An unknown or cross-story `afterPageId` yields `findIndex === -1`, silently inserting the new page at the front of the content pages instead of erroring. Harmless (no ownership leak) but surprising; a `BAD_REQUEST` on unknown anchor would be cleaner.

- **Test-suite claim not independently verified** — CHANGE_SUMMARY.md states 154 tests, build, and lint pass; the test run could not be executed in this judgement session (command approval denied). The test files themselves cover everything the plan's Tests section requires (helpers, `usePageForm` debounce/dirty, `usePagesEditor` focus + optimistic hide, router-level add/remove/hide/reorder/cover-rejection/rule-expansion), so this is noted for the record only.

- **`page.tsx` prefetches `page.listImages` for an unvalidated `?focus=` id** — `src/app/(app)/stories/[storyId]/pages/page.tsx:19`. Fine (the procedure enforces ownership server-side and a bogus id just wastes one prefetch), just noting it was considered.
