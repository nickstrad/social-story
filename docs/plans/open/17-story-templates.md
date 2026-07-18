# Plan 17 — Story Templates (second creation flow)

**Depends on:** everything through 13 (stories, characters, base image, pages, PDF). Independent of 14–16. No new AI actions — `docs/ai.md` needs no catalog change; instantiation is fully deterministic.

**Ordering vs Plan 18 (Character Library):** independent schemas, either order works, but **18-first is recommended** — with a character library in place, the Use-template cast rows can offer a per-slot library picker (name + photo + appearance filled in one pick), skipping the per-instance photo upload and autofill. The integration is small and belongs to whichever plan lands second: `template.instantiate` cast entries gain an optional `libraryCharacterId`, and instantiation copies that library character's photo (via `copyAsset`) and appearance/photoDescription into the created instance character — still deterministic, no AI. If 17 lands first, ship as written here and add that integration in 18.

## Context

Today the only way to make a story is the one-off flow: paste a script, AI-parse it, add characters/photos, generate images. This plan adds a second flow: a **template** — a story whose script, pages, image prompts, and rules are already authored — that a user instantiates repeatedly, supplying only a cast (names + photos) per family/person. Target use case: a business with a canned story ("First Day at Our Clinic") producing a personalized copy per client, with identical text/scenes every time.

### Design decision: role slots, not pre-defined character sets

Do **not** model multiple pre-defined character sets per template (e.g. a "single child" variant, a "family of 3" variant, a "family of 4" variant). That multiplies authoring work N× and every variant drifts independently — the opposite of the consistency a canned story is for. Instead, one template supports a variable cast through machinery that already exists:

- Template characters are **role slots** (e.g. `Child`, `Parent`, `Sibling`). A new `Character.isOptional` flag marks slots the instantiator may drop (family of 3 vs 4 = same template, one optional slot unchecked).
- Dropping a slot at instantiation reuses the existing `character.delete` cleanup (strips the id from `Page.characterIds` and `Rule.characterIds`).
- Adding an extra cast member beyond the template's slots works through the existing rule engine: an `ALWAYS_INCLUDE` / `TOGETHER` rule pulls them into rendered pages via `applyRulesToPage` — no page edits needed.
- Authors should write page `text` cast-neutrally where a slot is optional ("my family", not "Mom and Dad"); required slots may be named — names are substituted at instantiation (below). This is an authoring convention, documented in the template editor UI hint, not enforced.

Instantiation is a **deterministic clone + rename** — no AI call — so every instance has byte-identical text/prompts apart from names. That's the consistency guarantee, and it means no new fakes, no new task types, no Inngest changes.

### Scope boundaries (v1)

- Templates are per-user, like stories. A business = its own account reusing its own templates. No sharing, no public gallery, no org model (future plan). **But build the seam now so opening templates to other users later is a one-function change:**
  - All template _usage_ reads (`template.list` card data for a usable template, the instantiate read) go through a single `assertTemplateUsable(repos, templateId, userId)` helper in `src/server/api/ownership.ts`. Today it is identical to ownership + `kind === TEMPLATE`; later, sharing/visibility (e.g. a `Story.visibility` column or a share table — do **not** add either now) changes only this function.
  - Template _authoring_ (the story/character/page/rule routers editing a template) stays on plain `assertStoryOwnership` — sharing will never grant editing, so the two gates must not be conflated.
  - `buildInstantiation` is pure and takes template data as input, and the created instance's `userId` always comes from the caller's session, never from the template row — so cross-user instantiation already works the moment the usage gate allows it.
  - Instances must never reference template-owned rows or assets: `templateId` (SetNull) is the only edge, photos/appearance are cleared, no asset is cloned. This is already the design below; keep it that way so a template's owner deleting things can never break another user's instance.
- No asset is ever cloned. Photos, base image, and page images always belong to the instance (the `Asset.storyId` composite FK forbids cross-story sharing anyway). Instances regenerate base + page images with their own photos.

## Deliverables

### 1. Schema — `prisma/schema.prisma` + migration (via `db-migrate`, dev only)

- `enum StoryKind { STORY TEMPLATE }`; `Story.kind StoryKind @default(STORY)`.
- `Story.templateId String?` — self-relation to the source template, `onDelete: SetNull` (deleting a template never touches its instances). `@@index([userId, kind])` for the two list queries.
- `Character.isOptional Boolean @default(false)` — meaningful on template characters; instances get it copied but the UI ignores it there.
- Mirror all three in `src/server/domain/types.ts` and both repos (`src/server/repos/prisma/story-repo.ts`, `character-repo.ts`, `src/server/repos/memory.ts`).

### 2. Domain — `src/server/domain/instantiate.ts` (pure functions, the testable core)

- `remapCharacterIds(ids: string[], mapping: Map<string,string>): string[]` — old cuid → new cuid, drop unmapped (excluded optional slots).
- `renameInText(text: string, renames: Array<{ from: string; to: string }>): string` — whole-word, case-sensitive replacement with regex-escaped names; longest `from` first so `"Sam"`/`"Samantha"` don't collide.
- `buildInstantiation(template: { story; characters; rules; pages }, input: { title; cast: Array<{ templateCharacterId; name; include }> }): InstantiationPlan` — returns the full set of rows to create: story fields (kind `STORY`, `templateId` set, status `PARSED`, script copied, `coverNote` renamed), characters (name from cast; `photoAssetId`/`photoDescription`/`appearance` cleared — they describe the template's placeholder person, and photo autofill refills them), rules and pages with ids remapped and `text`/`imagePrompt`/title renamed. Pages copy `position`, `kind`, `steeringText`, `hidden`; never `selectedImageId` or images. Excluded slots: character omitted, id dropped everywhere, rules left with empty `characterIds` kept only if `kind === FREEFORM`.

### 3. Routers

- `src/server/api/routers/template.ts` (new, registered in `root.ts`):
  - `template.list` — stories with `kind: TEMPLATE` for the user (reuse story list shape + page/character counts).
  - `template.createFromStory({ storyId, title? })` — ownership-checked; clones the story into a new `kind: TEMPLATE` story using `buildInstantiation` with an identity cast (keep names, keep `appearance` here — it's the author's own placeholder), no photos/images copied. Lets a business perfect a one-off story first, then promote it.
  - `template.instantiate({ templateId, title, cast: [{ templateCharacterId, name (1–100 chars), include }] })` — asserts `assertTemplateUsable` (see scope boundaries; today = ownership + `kind === TEMPLATE`), requires ≥1 included slot and every non-optional slot included, runs `buildInstantiation`, persists in one transaction (`stories.create` → `characters.createMany` → `rules` → `pages.replaceAll`), returns `{ storyId }`.
- `src/server/api/routers/story.ts`: `story.list` and `story.get` filter/assert `kind: STORY` stays default behavior; template editing reuses the existing story/character/page/rule routers unchanged (a template _is_ a story), so only guard `pdf.export` and `story.parse`'s destructive re-parse warning copy — no logic change needed there.
- `character.update` accepts `isOptional`.

### 4. UI

- `src/app/(app)/templates/page.tsx` — template list (`TemplatesScreen`, mirrors `StoriesScreen`; card actions: **Use template**, Edit, Delete). Nav entry next to Stories.
- **Use template** flow — `src/components/templates/UseTemplateDialog.tsx` (dumb) + `src/hooks/useInstantiateTemplate.ts`: title field + one row per slot (template name → new-name input, include-checkbox on optional slots, disabled-checked on required). If Plan 18 (Character Library) has landed, each slot row also offers a pick-from-library option (fills name and carries `libraryCharacterId` so instantiation copies photo + appearance — see the ordering note at top). Submit → `template.instantiate` → `router.push` to `/stories/[id]/characters` (the instance lands as `PARSED`; the wizard's next step is photos). Step derivation in `src/lib/steps.ts` already handles this — verify, don't change.
- Template authoring reuses the whole existing story editor at `/stories/[storyId]/*`: add a `TEMPLATE` badge in `StoryStepsNav`, hide the Export step for templates (`deriveStepStates` gains a `kind` param), show the cast-neutral-text authoring hint on the pages editor, and add an "Optional slot" switch to `CharacterForm`. "Save as template" button on the story export/overview screen → `template.createFromStory`.
- Stories list stays templates-free (`kind: STORY` filter).

### 5. Docs

- One paragraph in `docs/ai.md` under extension rules noting instantiation is deterministic by design (no AI action; renames/remaps only) so future contributors don't "helpfully" add an AI rewrite step.

## Tests

- Unit `src/server/domain/__tests__/instantiate.test.ts`: `renameInText` (word boundary, substring names, regex chars in names), `remapCharacterIds`, `buildInstantiation` (id remapping across pages+rules, optional slot excluded end-to-end, photos/appearance cleared, `selectedImageId` never copied, FREEFORM rule survival).
- Integration `src/server/api/__tests__/template.int.test.ts` (in-memory repos, `createTestCaller`): instantiate happy path (instance is `PARSED`, characterIds valid, zero assets), required-slot-excluded rejected, cross-user template rejected, `createFromStory` produces photo-less template, deleting template nulls instance `templateId`.
- E2E `e2e/template.spec.ts` (fakes via `E2E_FAKES=1`, own server on :3100): create story → save as template → use template with renamed cast + one optional slot dropped → land on characters step → upload fixture photo → generate base image → generate a page image → page text shows the new name.

## Files created

`src/server/domain/instantiate.ts` (+test), `src/server/api/routers/template.ts` (+int test), `src/app/(app)/templates/page.tsx`, `src/components/templates/TemplatesScreen.tsx`, `UseTemplateDialog.tsx`, `src/hooks/useInstantiateTemplate.ts`, `e2e/template.spec.ts`, migration; edits to `schema.prisma`, `domain/types.ts`, both repo layers, `root.ts`, `story.ts`/`character.ts` routers, `steps.ts`, `StoryStepsNav.tsx`, `CharacterForm.tsx`, `docs/ai.md`.

## Acceptance criteria

- Manual: author a template with one optional sibling slot; instantiate twice — once as a single child, once as a family of 4 (3 slots + 1 rule-added extra) — both reach a finished, correctly named PDF with distinct photos.
- Instantiation makes zero AI/network calls; two instances of the same template with the same cast input have identical page text and prompts.
- Tests green; build + lint pass.
