# Plan 08 — Characters, Photos, Rules

**Depends on:** 01 (schema/storage), 03 (tRPC). **Blocks:** 09, 10. Can run in parallel with 05, 06, 07 (agree on repo method names from `src/server/ports/repos.ts`).

## Context

Read `docs/00-overview.md`. This replaces the CLI's `photos/` folder + `index.md` + hardcoded `familyCast`/`pairSiblings`: characters and rules are user data. Photo upload is one of the few non-tRPC endpoints (binary).

## Deliverables

### 1. Photo upload route — `src/app/api/upload/photo/route.ts`

POST multipart (`storyId`, `characterId`, file). Auth via `getServerSession`, ownership via `assertStoryOwnership`, validate MIME (`png|jpeg|webp`) and size (≤ 8MB), normalize to PNG ≤ 1024px longest side with sharp, `deps.storage.put(photoKey(storyId, characterId), ...)`, save `photoUrl` on the character, return `{ url }`. Extract pure `validateUpload({ mimeType, size })` into `src/server/domain/upload.ts` (+unit test).

### 2. tRPC routers

- `src/server/api/routers/character.ts`: `create/update/delete/listForStory` — fields: name (required), role, age, appearance, photoDescription. Delete also deletes the blob.
- `src/server/api/routers/rule.ts`: `create/update/delete/listForStory` — `{ kind, text, characterIds }`; zod-validate structured kinds require ≥1 characterId (TOGETHER ≥2). Register both in `root.ts`.

### 3. UI — `src/app/(app)/stories/[storyId]/characters/page.tsx`

Server component per the Suspense/hydration pattern (plan 03): `prefetch` `character.listForStory` + `rule.listForStory`, render `<HydrateClient>` + `<Suspense fallback={<CharactersSkeleton/>}>` + `ErrorBoundary` around the client screen; `useCharacters`/`useRules` read with `useSuspenseQuery`.

Dumb components (`src/components/characters/`), all composed from shadcn primitives (`Card`, `Avatar`, `Input`, `Textarea`, `Select`, `ToggleGroup`, `Dialog`/`Sheet` for edit forms, `AlertDialog` for deletes, `sonner` toasts on mutation results):

- `CharacterCard.tsx` — photo thumbnail (`Skeleton` while the blob loads or an upload is in flight; `Avatar` fallback when no photo), metadata, edit/delete buttons (all via props/callbacks).
- `CharacterForm.tsx` — controlled fields + photo dropzone area (props: `values`, `errors`, `photoPreviewUrl`, `uploadState`, `onChange`, `onPickFile`, `onSubmit`).
- `RuleList.tsx` / `RuleForm.tsx` — kind selector (shadcn `ToggleGroup`), character multi-select (shadcn `Checkbox` list or `Combobox`, options passed in), free text for FREEFORM. Show a human-readable rule sentence via pure `describeRule(rule, characters)` in `src/lib/ruleText.ts` (unit-test; e.g. "Allison and Ezra always appear together").

Hooks (`src/hooks/`):

- `useCharacters(storyId)` — list + CRUD mutations + invalidation.
- `useCharacterForm(storyId, character?)` — field state, validation (reuse `characterInput` zod from plan 04), photo upload (fetch POST to the upload route, progress/preview state).
- `useRules(storyId)` + `useRuleForm` — same pattern.

### 4. `next/image` config (one-time)

Blob images render via `next/image`, which requires the Vercel Blob hostname in `next.config.ts` `images.remotePatterns` (`*.public.blob.vercel-storage.com`; verify the exact pattern in the Next.js image docs under `node_modules/next/dist/docs/`). Do this here since this is the first plan that displays blob images; plans 09/11/12 rely on it.

## Tests

- Unit: `validateUpload`, `describeRule`, rule input zod edge cases (TOGETHER with 1 characterId rejected).
- Integration `src/server/__tests__/characters.int.test.ts`: caller CRUDs characters + rules against test DB with in-memory storage; delete character removes blob and its id from rules' `characterIds` (implement that cleanup in the router); cross-user access → NOT_FOUND.
- Hook test: `useCharacterForm` — invalid submit blocked; valid submit calls mutation; file pick sets preview + calls upload (mock fetch).

## Files created

`src/app/api/upload/photo/route.ts`, `src/server/domain/upload.ts` (+test), `src/server/api/routers/{character,rule}.ts`, `src/lib/ruleText.ts` (+test), `src/components/characters/*.tsx`, `src/hooks/{useCharacters,useCharacterForm,useRules,useRuleForm}.ts` (+tests), characters page.

## Acceptance criteria

- Manual: add two characters with photos, add a TOGETHER rule, see readable rule text.
- Tests green; build + lint pass.
