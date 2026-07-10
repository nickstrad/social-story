# Plan 11 — Page Editor UI

**Depends on:** 07 (story/pages exist, steps nav), 10 (generation hooks/endpoints). **Blocks:** 12.

## Context

Read `docs/00-overview.md`. This is the heart of the UX: `src/app/(app)/stories/[storyId]/pages/page.tsx`. Two modes on one screen: an **overview grid** (all pages, multi-select, bulk generate) and a **focused editor** (one page at a time: edit text/prompt/characters/steering, generate, compare variants, next/prev). All components dumb; all state in hooks.

## Deliverables

### 1. Page-editing tRPC ops — extend `src/server/api/routers/page.ts`

- `page.update({ pageId, text?, imagePrompt?, characterIds?, steeringText? })` — characterIds validated against story characters; rules applied via `applyRulesToPage` before save (return the effective list so the UI shows auto-added characters).
- `page.add({ storyId, afterPageId? })`, `page.remove({ pageId })` (refuse removing COVER), `page.setHidden({ pageId, hidden })`, `page.reorder({ storyId, orderedPageIds })` — implement with plan 04 `pageOps` + `PageRepo.replaceOrder`.

### 2. Dumb components — `src/components/pages/`

The route `page.tsx` is a server component per the Suspense/hydration pattern (plan 03): `prefetch` `story.get` (pages + characters + rules) and the focused page's `page.listImages` when deep-linked, wrap the client editor in `<HydrateClient>` + `<Suspense fallback={<PagesEditorSkeleton/>}>` + `ErrorBoundary`. `usePagesEditor` reads initial data via `useSuspenseQuery`; generation/task polling stays plain `useQuery`. Since this is the largest screen, the skeleton matters: grid of `Skeleton` cards + editor placeholder.

All built from shadcn primitives: `Card` (grid cards), `Checkbox` (selection), `Badge` (hidden/gen state), `Progress` (bulk bar), `Textarea`/`Input` (editors), `ScrollArea` (variant strip), `AlertDialog` (delete page), `Tooltip`, `sonner` toasts; icons from `lucide-react`. Consider `ResizablePanels` for the focus editor split — optional.

- `PageGrid.tsx` — thumbnails (selected image, or a `Skeleton` while that page's generation task is PENDING/RUNNING or the blob is still loading; a neutral "no image yet" placeholder otherwise), per-card: checkbox, hidden badge, gen-state badge, click → focus. Props only: `pages`, `selection`, `genStates`, callbacks.
- `PageGridToolbar.tsx` — select all/none, count, "Generate selected (N)", bulk progress bar (`done/total`).
- `PageFocusEditor.tsx` — left: image area (current variant — full-size `Skeleton` while generating or while the image loads; variant strip beneath with per-thumb skeletons, regenerate + steering textarea + generate button); right: text editor, imagePrompt editor, character checkboxes (with "added by rule" tags), hide toggle, delete, prev/next. ~All via props; split into `VariantStrip.tsx`, `PageMetaForm.tsx`, `SteeringBox.tsx` to stay dumb and small.
- `AddPageButton.tsx`, reorder via up/down buttons on cards (keep it simple; no dnd lib).

### 3. Hooks — `src/hooks/`

- `usePagesEditor(storyId)` — the orchestrator: loads `story.get`, holds `focusedPageId`, composes `useBulkGeneration` (plan 10) + per-focused-page `usePageGeneration` + `usePageMutations` (update/add/remove/hide/reorder with optimistic updates + invalidation). Keep it a composition of the smaller hooks; anything computable goes to pure helpers in `src/lib/pagesEditor.ts`: `nextFocusable(pages, currentId, dir)`, `effectiveCharacters(page, rules, characters)` (mirror server rule application for instant UI feedback), `gridBadge(page, genState)`. Unit-test all three.
- `usePageForm(page)` — local draft state for text/imagePrompt/steering with debounced `page.update`, dirty flag.

### 4. Wire into wizard

Pages step in `StoryStepsNav` links here; Export step (plan 12) enabled when ≥1 visible page has a selected image (extend `deriveStepStates` in `src/lib/steps.ts`).

## Tests

- Unit: `pagesEditor` helpers (`nextFocusable` skips hidden? — decision: focused editor includes hidden pages, PDF excludes them; document in helper), `effectiveCharacters` matches server rule results (reuse the same domain function — import from `src/server/domain/rules.ts`; it's pure so client-safe — move to `src/lib/domain-shared` re-export if bundling complains).
- Hook tests: `usePageForm` debounce + dirty; `usePagesEditor` focus navigation and optimistic hide.
- Integration `src/server/__tests__/pageOps.int.test.ts`: add/remove/hide/reorder through the caller; positions stay contiguous, cover pinned; remove COVER rejected; `page.update` returns rule-expanded characterIds.

## Files created

Extensions to `src/server/api/routers/page.ts`, `src/components/pages/*.tsx`, `src/hooks/{usePagesEditor,usePageForm}.ts` (+tests), `src/lib/pagesEditor.ts` (+test), pages route file.

## Acceptance criteria

- Manual walkthrough: parse a story → grid shows pages → select 3 → bulk generate (fakes or real) → focus a page → edit steering → regenerate → variant strip shows both, newest selected → hide a page → reorder.
- Tests green; build + lint pass.
