# Plan 10 — Page & Cover Image Generation (single, bulk, variants)

**Depends on:** 05, 06, 07, 08 (09 soft — anchor used when present). **Blocks:** 11, 12.

## Context

Read `docs/00-overview.md`, CLI `renderOne`/`mustGenerate`/`mustRedo`/`mustTitle`. Each generation is a `PAGE_IMAGE` task producing a new `PageImage` **variant** (never overwrite). The stored `url` is the **captioned** image; `rawUrl` is pre-caption (captioning is not idempotent, always re-caption from raw). The cover is just a Page with `kind: COVER` — same task type; its caption is the story title; its prompt uses `buildCoverPrompt` + `coverNote`.

## Deliverables

### 1. Router — `src/server/api/routers/page.ts` (generation parts; editing ops come in plan 11)

- `page.generate({ pageId, steeringText? })` — persists steeringText on the page, refuses if a PAGE_IMAGE task for this page is already PENDING/RUNNING, then `createTask(type: PAGE_IMAGE, pageId)`.
- `page.generateBulk({ storyId, pageIds })` — validates all pages belong to story, creates one task per page (Inngest concurrency from plan 05 throttles; CLI default 10). Returns taskIds.
- `page.selectImage({ pageId, pageImageId })` — sets `selectedImageId`.
- `page.listImages({ pageId })` — variants newest-first.
- Register in `root.ts`.

### 2. Task handler — `src/server/inngest/functions/pageImage.ts`

`registerTaskHandler('PAGE_IMAGE', ...)`:

1. Load page, story, characters, rules.
2. `applyRulesToPage(page.characterIds, rules, characters)` — enforce rules at generation time too (mirrors CLI enforcing on load).
3. Build prompt: COVER → `buildCoverPrompt({ title, characters: all, note: coverNote })`; PAGE → `buildImagePrompt({ scene: page.imagePrompt, characters: resolved, allCharacters, anchored, steeringText: page.steeringText })`.
4. References: if peopled (or cover) and `story.baseImageUrl` → fetch anchor buffer FIRST; optionally attach at most one character photo — port the CLI `pickPhoto` idea deterministically instead of an extra LLM call: pure `pickReferencePhoto(pageCharacterIds, characters)` in `src/server/domain/photoPick.ts` (choose the single-character photo when exactly one page character has a photo and no anchor exists; with an anchor, attach no extra photo). Unit-test the policy.
5. `deps.image.generate(...)` → raw PNG → `storage.put(rawKey)`; caption text = page.text (cover: story.title) → `addCaptionBand(raw, text)` → `storage.put(finalKey)`.
6. Create `PageImage` with `variant = nextVariant(existing)` (plan 04), `promptUsed`; auto-select it (`selectedImageId`) — regenerate-then-compare still works because older variants remain listed. `resultJson: { pageImageId }`.

### 3. Hooks (UI itself is plan 11)

- `src/hooks/usePageGeneration.ts`: `usePageGeneration(pageId)` — mutation + active-task polling for one page. Derive the active task from `task.listForStory` filtered by `pageId` (NOT from a taskId held in component state) so in-flight generations survive a page reload. Exposes `state: idle|queued|generating|done|failed`, `latestImageUrl`, `generate(steeringText)`, `retry`. Pure `derivePageGenState(tasks, images)` — unit-test.
- `src/hooks/useBulkGeneration.ts`: select-set state (`Set<pageId>`, selectAll/none/toggle as pure functions in `src/lib/selection.ts` — unit-test), fires `generateBulk`, aggregates progress from `useStoryTasks`.

## Tests

- Unit: `photoPick` policy, `derivePageGenState`, `selection` helpers.
- Integration `src/server/__tests__/pageImage.int.test.ts` (**the** key merge seam — rules + prompts + image + caption + storage + variants):
  - Peopled page with TOGETHER rule missing a sibling → fake ImageGenerator receives prompt containing both names and anchor-first references; PageImage v1 created, captioned image taller than raw, selected.
  - Second run → v2, selected flips to v2, v1 retained.
  - Scene-only page → prompt has NO-people line, no references.
  - Cover → title caption, coverNote in prompt.
  - Generator throws → task FAILED, no PageImage row.
  - Duplicate `page.generate` while active → rejected.

## Files created

`src/server/api/routers/page.ts`, `src/server/inngest/functions/pageImage.ts`, `src/server/domain/photoPick.ts` (+test), `src/lib/selection.ts` (+test), `src/hooks/{usePageGeneration,useBulkGeneration}.ts` (+tests).

## Acceptance criteria

- Integration suite above green with fakes; manual single-page generation works end-to-end with real services.
- Build + lint pass.
