# Plan 07 — Story CRUD + Script → Pages Parse Flow

**Depends on:** 03 (tRPC), 04 (domain), 05 (tasks), 06 (TextGenerator). **Blocks:** 10, 11.

## Context

Read `docs/00-overview.md`. The user pastes a raw social-story script; parsing it into pages is a `PARSE_STORY` task using `deps.text.generateJson` with `parsedStorySchema` + `buildParseSystemPrompt` (plan 04). Parsing may run before characters exist (prompt then omits the roster and returns `characterNames` best-effort; re-parse is allowed while status is DRAFT/PARSED).

## Deliverables

### 1. tRPC router — `src/server/api/routers/story.ts`

- `story.create({ title?, script })` → creates DRAFT story.
- `story.list()`, `story.get({ storyId })` (with pages, characters, rules, counts), `story.updateScript`, `story.updateTitle`, `story.updateCoverNote`, `story.delete` (also best-effort deletes the story's blobs — add `Storage.deleteByPrefix?(prefix)` or iterate known URLs from characters/pageImages/baseImageUrl; blob-delete failures must not block the DB delete).
- `story.parse({ storyId })` → `createTask(type: PARSE_STORY)`; returns taskId.
- All ownership-checked; register in `root.ts`.

### 2. Parse task handler — `src/server/inngest/functions/parseStory.ts`

`registerTaskHandler('PARSE_STORY', ...)`:

1. Load story + characters + rules via repos.
2. `deps.text.generateJson({ system: buildParseSystemPrompt(characters, rules), user: story.script, schema: parsedStorySchema })`.
3. `parsedStoryToPages(parsed, characters)` then `applyRulesToStory(...)` (plan 04).
4. Replace the story's pages atomically (`PageRepo.replaceAll(storyId, pages)` — add to the repo port; delete-and-recreate is fine, but preserve nothing since re-parse is destructive — **guard**: refuse (task FAILED with clear error) if any page already has a PageImage, so users can't nuke generated art accidentally).
5. Set story.title from parse result when user left it blank; status → PARSED. `resultJson: { pageCount }`.

### 3. UI

All components compose shadcn primitives from `src/components/ui/` (Card, Button, Input, Textarea, Badge, Skeleton, Tabs; mutation feedback via `sonner` toasts).

**Routes follow the Suspense/hydration pattern (overview + plan 03):** each `page.tsx` is a server component that `prefetch`es its queries (`story.list` for the index; `story.get` for the script step) and renders `<HydrateClient>` + `<Suspense fallback={<...Skeleton/>}>` + `<ErrorBoundary>` around a client screen component. Hooks (`useStories`, `useScriptEditor`) read initial data with `useSuspenseQuery`; the parse-task polling inside `useScriptEditor` stays plain `useQuery`. Add `StoryListSkeleton` / `ScriptEditorSkeleton` (shadcn `Skeleton`) matching the real layouts. While a parse task is PENDING/RUNNING, `ScriptEditor` shows a skeleton page-list preview (rows of `Skeleton` bars) in place of the eventual page count/summary, not just the status badge.

- `src/app/(app)/stories/page.tsx` — story list + "New story". Dumb `StoryList` component (shadcn `Card` grid + `Empty` state) + `useStories` hook.
- `src/app/(app)/stories/new/page.tsx` + `src/app/(app)/stories/[storyId]/script/page.tsx` — script entry/edit step.
  - Dumb `src/components/story/ScriptEditor.tsx` — props: `title`, `script`, `parseState` (`idle|parsing|done|error`), `pageCount?`, `error?`, `canReparse`, `onChangeTitle/Script`, `onParse`. shadcn `Textarea`/`Input`/`Button`, char count, `TaskStatusBadge`.
  - Hook `src/hooks/useScriptEditor.ts` — loads story, local draft state with debounced save (`story.updateScript`), fires `story.parse`, then `useTask(taskId)` until terminal, invalidates `story.get`. Extract pure `deriveParseState(task, story)` and unit-test it.
- Wizard shell: `src/components/story/StoryStepsNav.tsx` (dumb; shadcn `Tabs` or `Breadcrumb`) — steps: Script → Characters → Base image → Pages → Export, with per-step done/enabled flags computed by pure `deriveStepStates(story)` in `src/lib/steps.ts` (unit-test). Used by all `(app)/stories/[storyId]/*` pages.

## Tests

- Unit: `deriveParseState`, `deriveStepStates`.
- Integration `src/server/__tests__/parse.int.test.ts` (key seam — full merge of domain + task + text port): test caller creates story with a fake `TextGenerator` returning a canned parsed story (incl. an unknown character name and a rule violation); run parse task via `immediateDispatcher`; assert pages persisted in order, cover at 0, unknown name dropped, rules applied, story PARSED; re-parse with existing PageImage → task FAILED with guard message.
- Hook test: `useScriptEditor` happy path with mocked tRPC (parse → polling → done).

## Files created

`src/server/api/routers/story.ts`, `src/server/inngest/functions/parseStory.ts`, `src/lib/steps.ts` (+test), `src/components/story/{ScriptEditor,StoryList,StoryStepsNav}.tsx`, `src/hooks/{useStories,useScriptEditor}.ts` (+tests), pages under `src/app/(app)/stories/`.

## Acceptance criteria

- Manual: paste `cli/example_story.txt` content, parse (real token + inngest dev), see page count; or verify via integration test with fakes.
- Tests green; build + lint pass.
