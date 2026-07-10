# Change summary — feature/page-generation

Plan: docs/10-page-generation.md

## What was implemented

### Router — `src/server/api/routers/page.ts` (registered in `root.ts` as `page`)

- `page.generate({ pageId, steeringText? })` — persists `steeringText` on the page (when provided), refuses with `CONFLICT` if a `PAGE_IMAGE` task for this page is already PENDING/RUNNING, then `createTask(PAGE_IMAGE, pageId)`. Returns `{ taskId }`.
- `page.generateBulk({ storyId, pageIds })` — validates every page belongs to the story, **skips pages that already have an active PAGE_IMAGE task** (so bulk can't race a single `generate`), creates one task per remaining page, returns `{ taskIds, skipped }`. Inngest concurrency (plan 05) throttles execution.
- `page.selectImage({ pageId, pageImageId })` — validates the image belongs to the page, sets `selectedImageId`.
- `page.listImages({ pageId })` — variants newest-first.

### Task handler — `src/server/inngest/functions/pageImage.ts`

`registerTaskHandler('PAGE_IMAGE', …)` (side-effect import added to `functions/index.ts`):

1. Loads page, story, characters, rules.
2. Re-applies rules at generation time via `applyRulesToPage` (mirrors CLI enforcing on load).
3. Builds the prompt — COVER → `buildCoverPrompt` (title caption, `coverNote`); PAGE → `buildImagePrompt` (scene, resolved cast, `anchored`, `steeringText`, rules).
4. References: anchor sheet FIRST when peopled/cover and `story.baseImageUrl` set; then at most one deterministically-chosen character photo via `pickReferencePhoto`.
5. Generates raw PNG → stores raw → captions from raw (title for cover, page text otherwise) → stores captioned.
6. Creates `PageImage` with `nextVariant`, `promptUsed`, `rawUrl`; auto-selects it. Returns `{ pageImageId }`.

### Domain / lib helpers (pure, unit-tested)

- `src/server/domain/photoPick.ts` — `pickReferencePhoto({ pageCharacters, hasAnchor })`: no photo under an anchor; otherwise the sole photo iff exactly one page character has one.
- `src/lib/selection.ts` — `toggle` / `selectAll` / `selectNone` / `isAllSelected` over a `Set<pageId>`.
- `src/server/services/storage-keys.ts` — added `pageImageRawKey` (`v{n}-raw.png`).

### Hooks

- `src/hooks/usePageGeneration.ts` — `usePageGeneration(pageId, storyId)`; active task derived from `task.listForStory` filtered by pageId (survives reload). Pure `derivePageGenState(tasks, images)` → `idle|queued|generating|done|failed` + `latestImageUrl`. Exposes `generate(steeringText)` and `retry`.
- `src/hooks/useBulkGeneration.ts` — select-set state via `src/lib/selection`, fires `generateBulk`, aggregates progress from `useStoryTasks`/`summarizeStoryTasks`.

### Tests

- Unit: `photoPick`, `selection`, `derivePageGenState`, and the new `hasActiveTask` predicate.
- Integration `src/server/__tests__/pageImage.int.test.ts` (gated on `DATABASE_URL`): peopled page with TOGETHER rule (both names in prompt, anchor-first refs, v1 selected, caption taller than raw), second run → v2 selected with v1 retained, scene-only page (NO-people line, no refs), cover (title caption + coverNote), generator throws → task FAILED with no PageImage row, and duplicate `page.generate` while active → rejected (via `createTestCaller`). All 5 pass locally.

## What /simplify changed

- **Efficiency:** in `pageImage.ts`, overlapped the `listImages` read with `image.generate`, and the raw-blob `storage.put` with `addCaptionBand` (both independent) via `Promise.all`.
- **Reuse:** extracted `toReferenceImage(deps, url)` into `src/server/services/references.ts`; `baseImage.ts` and `pageImage.ts` now share it (single home for the "stored blobs are PNG" invariant).
- **Altitude / dedup:** added `hasActiveTask(tasks, { type, pageId? })` and `isActiveTask` to `taskMachine.ts`; `page.ts` and `story.ts` (parse guard) now use it instead of hand-rolled PENDING/RUNNING checks.
- **Simplification:** `pickReferencePhoto` now takes the already-resolved page characters (`pageCharacters`) instead of `pageCharacterIds` + full roster, removing a duplicate `byId` map rebuild; `hasAnchor: anchored` passed directly.
- Skipped (noted, not applied): full COVER/PAGE strategy-map refactor and `pageImageKey` options-param merge (over-engineering for two kinds / breaks the existing standalone key-builder style); `selectAll`/`selectNone` inlining and a shared transition-toast hook (low value / non-trivial due to differing state enums).

## Judge feedback addressed (verdict was READY)

- **Should-fix:** integration test now asserts the succeeded task's `resultJson` equals `{ pageImageId }`.
- **Should-fix:** `generateBulk` now skips already-active pages and returns `skipped` (closes the race with single `generate`); covered by a new router test.
- **Nit:** `page.generate` now persists `steeringText` _before_ the active-task guard (plan's stated order), so a rejected render still records the author's direction.
- **Nit:** cover integration test now runs with a base image set and asserts the anchor reference is attached (anchor-first branch for covers).
- **Nit:** extracted `summarizePageProgress` (pure) from `useBulkGeneration` and unit-tested the PAGE_IMAGE-only progress filter, matching the repo's pure-helper test convention.

## Notes for review

- **Deviation:** `usePageGeneration(pageId, storyId)` takes `storyId` too (the plan wrote `usePageGeneration(pageId)`). `task.listForStory` and the poll are story-scoped and there is no `page.get` to resolve `storyId` from `pageId`, so the caller (plan 11 UI) must supply it.
- `generateBulk` intentionally has no per-page active-task guard (plan says "one task per page"); Inngest concurrency throttles.
- `page.listImages` reverses the repo's ascending-variant order for newest-first; the repo still returns ascending for other callers.
- UI is out of scope (plan 11); only hooks were built here.
- Build, lint, typecheck, and full test suite (39 files / ~130 tests) all green.
