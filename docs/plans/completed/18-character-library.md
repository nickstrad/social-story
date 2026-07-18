# Plan 18 — Character Library (saved characters, reusable across stories)

**Depends on:** everything through 13 (stories, characters, base image). Independent of 14–16. Independent of 17 (Story Templates), but see **Ordering vs Plan 17** below — implementing 18 first makes 17's instantiation flow markedly better, and each plan carries a small integration section for whichever lands second.

## Context

Today a character exists only inside one story: photo uploaded per story, appearance auto-filled per story, and nothing carries over. A family making their 20th story re-enters the same people 20 times and re-spends upload bandwidth and AI autofill calls each time. This plan adds a per-user **character library**: enter each family member once (name, photo, description, appearance), then build any number of stories by picking from the library. It also adds deterministic **base image reuse** across stories with the same cast, so the expensive AI base-image generation runs once per cast, not once per story.

Three user-facing pieces:

1. A `/characters` page — full CRUD over library characters, independent of any story.
2. In the one-off story flow's characters step — "Add from library" (pick one or more existing characters) alongside the existing "create new" path, plus "Save to library" on a story character.
3. On the base-image step — "Reuse base image from a previous story" when another story has the same cast, copying the image instead of regenerating.

### Design decision: copy-on-use, never shared references

A library character added to a story **copies** its fields and photo into a normal story-scoped `Character` + story-scoped `Asset` (server-side blob-to-blob copy). Stories never point at library assets. Rationale:

- Every existing invariant survives untouched: `Asset.storyId` composite FK, story-cascade cleanup, `character.delete`'s photo-asset deletion, the templates plan's "no cross-story asset sharing" rule.
- No reference counting, no "can't delete — in use by 3 stories" states. Deleting a library character never touches any story; deleting a story never touches the library.
- The bandwidth that matters is saved anyway: the user uploads the photo once and autofill runs once (appearance/photoDescription are copied, not regenerated). A server-side blob copy of a ~1 MB photo is negligible.

Provenance is tracked with a nullable `Character.libraryCharacterId` (SetNull) — used to grey out already-added characters in the picker and to detect same-cast stories for base image reuse. It is informational, never an ownership edge.

### Design decision: library shape mirrors story characters exactly

`LibraryCharacter` has the same content fields as `Character` (`name`, `role`, `age`, `appearance`, `photoAssetId`, `photoDescription`) so copy-in/copy-out is a field-for-field move and `CharacterForm`/`useCharacterForm` are reused nearly verbatim. No library-only fields in v1.

### Scope boundaries (v1)

- Library is strictly per-user. No sharing, no org/family accounts (future plan, same seam as template sharing in Plan 17).
- No sync-back: editing a library character does not update story characters copied from it earlier, and vice versa. Copies are snapshots.
- Base image reuse is offered only when casts match exactly (same set of `libraryCharacterId`s, source base image exists); the server enforces only ownership + existence, the cast match is a UI affordance.

## Deliverables

### 1. Schema — `prisma/schema.prisma` + migration (via `db-migrate`, dev only)

- New model `LibraryCharacter`: `id` cuid, `userId` FK (`onDelete: Cascade`), `name`, `role?`, `age?`, `appearance?`, `photoAssetId? @unique` → Asset (`onDelete: SetNull`, relation `"LibraryCharacterPhoto"`), `photoDescription?`, timestamps, `@@index([userId])`.
- `Asset.storyId String?` becomes **nullable** (relation optional; the composite FK `[storyId, userId] → [id, userId]` simply doesn't apply on null). Library photos are user-scoped assets with `storyId: null`. All existing story assets keep non-null `storyId`; no data migration needed.
- `AssetKind` gains `LIBRARY_PHOTO`; add it to `BROWSER_ASSET_KINDS` so `/api/me/assets/[assetId]` serves it (it's already user-scoped via `getOwnedById`).
- `Character.libraryCharacterId String?` — provenance, `onDelete: SetNull`, no index needed beyond the relation.
- Mirror in `src/server/domain/types.ts` (`LibraryCharacter`, `ClientLibraryCharacter` with `photoUrl`, `Create/UpdateLibraryCharacter`; `Character.libraryCharacterId`; `Asset.storyId: string | null`) and both repo layers.

### 2. Storage keys — `src/server/services/storage-keys.ts`

- `libraryPhotoKey(userId, libraryCharacterId)` = `users/{userId}/library/photos/{libraryCharacterId}.png`. First non-`stories/`-prefixed key; the scheme deliberately opens a `users/{userId}/…` namespace for future user-scoped assets.

### 3. Repos — port + both implementations

- `LibraryCharacterRepo` in `src/server/ports/repos.ts`: `create`, `getOwnedById(id, userId)`, `listByUser(userId)`, `update`, `delete`. Ownership is direct via `userId` (unlike story characters, which inherit it via the story).
- `src/server/repos/prisma/library-character-repo.ts` (new) and `src/server/repos/memory.ts` (extend, including snapshot/restore).

### 4. Services — `src/server/services/assets.ts`

- `replaceLibraryPhotoAsset` — thin wrapper over the existing `replaceAssetReference`, targeting `LibraryCharacter.photoAssetId`, kind `LIBRARY_PHOTO`, key from `libraryPhotoKey`.
- `copyAsset(deps, source: Asset, targetKey, { storyId, kind }): Promise<Asset>` — reads the source blob (`fetchAssetBuffer`), `storage.put` at the new key, creates the new asset row. Pure copy; used by add-from-library, save-to-library, and base image reuse. Deterministic, no AI.
- `clientLibraryCharacter` mapper (photoUrl via `assetUrl`).

### 5. Routers

- `src/server/api/routers/library.ts` (new, registered in `root.ts`) — named `library` (not `libraryCharacter`) so future library-shaped things (shared templates, rule presets) have a home:
  - `library.characters.list` → `ClientLibraryCharacter[]` for the session user.
  - `library.characters.create({ character })` / `update({ libraryCharacterId, character })` / `delete({ libraryCharacterId })` — reuse `characterInputSchema`; delete removes the photo asset + blob (same transaction pattern as `character.delete`, minus the rules cleanup — stories are untouched by design).
- `src/server/api/routers/character.ts`:
  - `character.addFromLibrary({ storyId, libraryCharacterIds: string[] (1–20) })` — asserts story ownership and library ownership of every id; for each: create story `Character` with copied fields + `libraryCharacterId` set, and if the library character has a photo, `copyAsset` it to `photoKey(storyId, characterId)` as `CHARACTER_PHOTO`. Returns created `ClientCharacter[]`. Skips nothing silently — an unowned/missing id fails the whole call.
  - `character.saveToLibrary({ storyId, characterId })` — reverse copy: creates a `LibraryCharacter` from the story character (photo copied to `libraryPhotoKey`), sets the story character's `libraryCharacterId` to the new id. Rejects if the character already has `libraryCharacterId` pointing at an existing library entry (idempotence guard).
- `src/server/api/routers/story.ts`:
  - `story.reuseBaseImage({ storyId, sourceStoryId })` — asserts ownership of both, requires source `baseImageAssetId`, `copyAsset`s the blob to `baseImageKey(storyId)` and sets it via the existing `replaceStoryBaseAsset` path (so any old base is cleaned up). No AI call, no task, synchronous.
  - `story.get` characters already return full rows; add `libraryCharacterId` to `clientCharacter` so the UI can grey out picker entries and compute cast matches.
  - `story.list` (or a small dedicated query `story.baseImageSources({ storyId })`) exposes, for the base step, the user's other stories that have a base image plus their characters' `libraryCharacterId` sets, so the client can filter to exact-cast matches. Prefer the dedicated query — it keeps `story.list` lean.

### 6. Upload + autofill endpoints

- `src/app/api/upload/library-photo/route.ts` (new) — multipart `libraryCharacterId`, `file`; session → `validateUpload` → `getOwnedById` ownership check → `normalizeReferencePhoto` → `replaceLibraryPhotoAsset`. Mirrors `/api/upload/photo`.
- `src/app/api/describe/photo/route.ts` — make `storyId` optional. The endpoint is stateless (no repo/storage writes); when `storyId` is present keep the ownership assert, when absent the session gate suffices. `useCharacterForm` passes it only in story context.

### 7. UI

- `src/app/(app)/characters/page.tsx` — the library page (`LibraryScreen` in `src/components/library/`): grid of `CharacterCard`s, create/edit dialog reusing `CharacterForm` via a `useLibraryCharacterForm` variant of `useCharacterForm` (same shape; different upload URL, no storyId, library mutations from a new `src/hooks/useLibraryCharacters.ts`). Nav entry "Characters" beside Stories.
- Story characters step (`CharactersScreen`): "Add from library" button → `AddFromLibraryDialog` (`src/components/characters/`): multi-select list of library characters with photo thumbnails; entries whose id already appears in the story's `libraryCharacterId`s are shown checked-and-disabled. Submit → `character.addFromLibrary`. Empty library → dialog shows a link to `/characters`.
- Character card menu gains "Save to library" (hidden when `libraryCharacterId` is set).
- Base image step: when `story.baseImageSources` returns ≥1 exact-cast match, show a "Reuse base image" affordance (source story title + thumbnail) next to Generate; clicking calls `story.reuseBaseImage`. When there's no match, nothing new renders.
- `src/lib/steps.ts` needs no changes — added-from-library characters count like any others.

### 8. Docs

- `docs/ai.md`: one line noting `/api/describe/photo` is usable without a story (library context) and that add-from-library/base-image-reuse are deterministic copies, never AI calls.

## Ordering vs Plan 17 (Story Templates)

The plans are schema-independent and can land in either order, but **18-before-17 is recommended**: with a library in place, Plan 17's `UseTemplateDialog` cast rows can offer a library picker per slot (pick "Danny" → name, photo, appearance, photoDescription all filled), which turns template instantiation into near-one-click and skips the per-instance photo upload + autofill entirely. The integration itself is small and belongs to whichever plan lands **second**:

- `template.instantiate` cast entries gain optional `libraryCharacterId`; instantiation, after `buildInstantiation`, copies photo/appearance/photoDescription from the library entry into the created instance character (same `copyAsset` + field copy as `character.addFromLibrary`). Still deterministic — no AI.
- `UseTemplateDialog` slot rows gain a "pick from library" option beside the name input.

Plan 17 has a mirrored note. If 17 lands first, ship it as written and add this integration as part of 18.

## Tests

- Unit: none needed beyond repos — the logic is copies + ownership checks; `copyAsset` is exercised via integration.
- Integration `src/server/api/__tests__/library.int.test.ts` (in-memory repos, `createTestCaller`):
  - library CRUD happy path; cross-user `getOwnedById` rejected on update/delete/upload.
  - `addFromLibrary` copies fields + creates a story-scoped photo asset at the story key (distinct asset id/locator from the library's), sets `libraryCharacterId`; unowned library id in the batch fails the whole call.
  - `saveToLibrary` round-trip; second call on the same character rejected.
  - deleting a library character leaves story characters + their photos intact (`libraryCharacterId` nulled); deleting a story leaves the library intact.
  - `reuseBaseImage` copies the blob (source story still has its asset), replaces an existing base, rejects when source has none or is cross-user.
- E2E `e2e/specs/library.spec.ts` (fakes, own server on :3100): create two library characters on `/characters` with fixture photo + autofill → new story → add both from library (photos visible, no upload) → generate base image → second story → add same cast → reuse base image from story 1 (no generate task) → both stories show the base image.

## Files created

`src/server/repos/prisma/library-character-repo.ts`, `src/server/api/routers/library.ts` (+int test), `src/app/(app)/characters/page.tsx`, `src/components/library/LibraryScreen.tsx`, `src/components/characters/AddFromLibraryDialog.tsx`, `src/hooks/useLibraryCharacters.ts`, `src/hooks/useLibraryCharacterForm.ts`, `src/app/api/upload/library-photo/route.ts`, `e2e/specs/library.spec.ts`, migration; edits to `schema.prisma`, `domain/types.ts`, `ports/repos.ts`, `repos/memory.ts`, `services/assets.ts`, `storage-keys.ts`, `routers/character.ts`/`story.ts`/`root.ts`, `CharactersScreen.tsx`, `CharacterCard.tsx`, describe-photo route, nav, `docs/ai.md`.

## Acceptance criteria

- Manual: enter a family of 4 once on `/characters`; build two stories entirely from the library (zero photo uploads, zero autofill calls in-story); reuse the first story's base image in the second; both export correct PDFs. Delete a library character afterwards — both stories unaffected.
- `addFromLibrary` and `reuseBaseImage` make zero AI/network calls beyond blob copy.
- Deleting any story never deletes or mutates library data; deleting library data never mutates any story.
- Tests green; build + lint pass.
