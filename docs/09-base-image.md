# Plan 09 — Base Image (Character Reference Sheet)

**Depends on:** 05 (tasks), 06 (ImageGenerator/storage), 08 (characters). Can run in parallel with 07, 10 (10 uses `story.baseImageUrl` if present — soft dependency).

## Context

Read `docs/00-overview.md` and CLI `mustBase`. The base image is a character sheet generated from all character photos; it is attached as the FIRST reference image to every peopled page (and cover) for cross-page consistency. Regenerating overwrites (it's an anchor, not content — no variants needed).

## Deliverables

### 1. Router additions — extend `src/server/api/routers/story.ts`

- `story.generateBaseImage({ storyId })` → requires ≥1 character; `createTask(type: BASE_IMAGE)`.

### 2. Task handler — `src/server/inngest/functions/baseImage.ts`

`registerTaskHandler('BASE_IMAGE', ...)`:

1. Load characters; download each `photoUrl` via `deps.storage.fetchBuffer` (skip photo-less characters).
2. Prompt: `buildBaseSheetPrompt(characters)` (plan 04).
3. `deps.image.generate({ prompt, referenceImages, width: 1024, height: 1024 })`.
4. `deps.storage.put(baseKey(storyId), png, 'image/png')`; set `story.baseImageUrl` (if a previous base URL existed, best-effort `storage.delete` it after the swap — blob puts get random suffixes, so old blobs orphan otherwise); `resultJson: { url }`.

Works with zero photos too (sheet from appearance text alone) — mirror CLI behavior.

### 3. UI — `src/app/(app)/stories/[storyId]/base/page.tsx`

Server component per the Suspense/hydration pattern (plan 03): `prefetch` `story.get` + `character.listForStory`, wrap the client screen in `<HydrateClient>` + `<Suspense fallback={<BaseImageSkeleton/>}>` + `ErrorBoundary`; `useBaseImage` reads initial data with `useSuspenseQuery` (its task polling stays plain `useQuery`).

- Dumb `src/components/story/BaseImagePanel.tsx` (shadcn `Card`, `Button`, `Empty` when no characters; a full-size image-shaped `Skeleton` while the BASE_IMAGE task is PENDING/RUNNING and while the finished sheet downloads) — props: `imageUrl?`, `taskState`, `characterCount`, `onGenerate`, `onRegenerate`. Shows the sheet, a generate/regenerate button, task badge, and a hint when no characters exist (link back to characters step).
- Hook `src/hooks/useBaseImage.ts` — reads story, fires mutation, `useTask` polling, invalidates on success. Pure helper `canGenerateBase(story, characters, activeTask)` in the hook file — unit-test it (no characters → false; task running → false).

## Tests

- Unit: `canGenerateBase`.
- Integration `src/server/__tests__/baseImage.int.test.ts` (key seam — storage + image port + task merge): seed story with 2 characters (one with an in-memory photo); run task with fake ImageGenerator (assert it received the photo buffer as reference and a prompt containing both names); assert blob written and `baseImageUrl` set; failure path (image gen throws) → task FAILED, `baseImageUrl` unchanged.

## Files created

`src/server/inngest/functions/baseImage.ts`, `src/components/story/BaseImagePanel.tsx`, `src/hooks/useBaseImage.ts` (+test), base page; edits to story router.

## Acceptance criteria

- Manual (real token): generate a sheet from two uploaded photos; regenerate replaces it.
- Tests green; build + lint pass.
