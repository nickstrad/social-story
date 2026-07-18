# Plan 20 — Flexible, reliable per-page character assignment

**Depends on:** 07 (story parse flow), 08 (characters & rules), 10 (page
generation), 11 (page editor UI).

## Context

A recent story produced a PDF where only the cover had characters; every
content page was scene-only. The old Go CLI (`cli/main.go`) produced characters
throughout for the same kind of story. Diagnosis:

- The cover branch of the `PAGE_IMAGE` task passes the **full cast**
  unconditionally, while content pages depend on `page.characterIds`
  (`src/server/inngest/functions/pageImage.ts`). Empty IDs on every page ⇒
  characters on the cover only — exactly the observed symptom.
- An empty `characterIds` is not a soft failure: `buildImagePrompt`
  (`src/server/ai/prompts/illustration.ts`) emits an explicit "This page has
  NO people in it" instruction. That line is correct design (the CLI had it
  too) — the bug is how pages _end up_ empty.
- **Silent name-drop.** `parsedStoryToPages` (`src/server/domain/pageOps.ts`)
  resolves the model's `characterNames` through an exact-match `Map` keyed on
  `character.name` — no trim, no case-folding — and drops any miss silently.
  The structured-output schema (`parsedStorySchema` in
  `src/server/domain/schemas.ts`) is an unconstrained `z.array(z.string())`,
  so the model is free to return `"mom"`, `"Allison (the narrator)"`, etc.
  The CLI never had this seam: it hardcoded four names into the prompt and
  passed the model's strings straight into the image prompt.
- **Zero-character parse.** `story.parse` (`src/server/api/routers/story.ts`)
  runs happily on a story with no characters defined. The parse prompt then
  says "No recurring characters have been defined. Use an empty
  characterNames array." — and every page is correctly scene-only forever.
  Adding characters later never backfills, and re-parse is blocked once any
  page has images.
- Rules cannot rescue an empty page: `ALWAYS_INCLUDE` and `TOGETHER` in
  `applyRulesToPage` (`src/server/domain/rules.ts`) only fire when someone is
  already present. That gating is deliberate (keeps scene-only pages
  people-free) and **stays as-is**.

### Goal

Characters (and rules) are defined **before** the script is split into pages,
so the parse LLM always judges — per page, with the real roster and rules in
context — whether a character belongs in the illustration or the page should
stand alone as a scene. Keep that decision with the LLM, make the plumbing
lossless, and make the user's override visible and editable _at the point of
image creation_. Note the override mechanism already exists (`PageMetaForm`
character toggles → `page.update({ characterIds })`, applied at generation
time); the gap is flow ordering, robustness, and visibility — not capability.

### Design decision: constrain the model, don't post-process harder

With OpenAI structured outputs in `strict` mode, an enum-constrained schema
makes off-roster names **impossible** rather than merely unlikely. So the
primary fix is a per-request schema whose `characterNames` items are
`z.enum([...roster names])`. Fuzzy matching / normalization becomes a thin
defensive layer, not the mechanism.

### Design decision: characters before parse — reorder the flow, not just warn

The parse prompt already receives the full roster and rules
(`buildParseSystemPrompt(characters, rules)`) and instructs the model to
assign characters per page — the LLM-judges-fit behavior is the existing
design. It only degrades when parse runs against an empty roster. The wizard
step order is already Script → Characters → Base → Pages (`src/lib/steps.ts`),
but the "Parse into pages" button lives on the **Script** screen (step 1), so
the natural flow invites parsing before the roster exists.

Fix the flow, not the symptom: move the parse action after the Characters
step, so by the time the story is split into pages the model always sees
whatever roster and rules the user intends. Parsing with a deliberately empty
roster stays legitimate (a fully scene-only book) behind a lightweight
confirmation — the server stays permissive, no new task states.

### Design decision: LLM keeps deciding the mix

The parse prompt keeps "do NOT put people on every page" but gains the CLI's
balancing guidance (a good mix; small groups when people appear; map the
first-person narrator to the roster character the story is about). Author
rules continue to be passed verbatim and applied server-side afterwards.

## Scope boundaries (v1)

- No backfill/re-assign-via-AI flow for already-parsed stories; manual toggles
  cover that. (A "suggest characters for this page" action is future work.)
- Override UI lives in the focus editor only (same boundary as plan 19);
  bulk-generate keeps using each page's stored/effective IDs.
- No change to rules semantics or to the cover's full-cast behavior.

## Deliverables

1. **Roster-constrained parse schema** (`src/server/domain/schemas.ts`)
   - `buildParsedStorySchema(characterNames: string[])`: same shape as
     `parsedStorySchema`, but `characterNames` items are
     `z.enum(characterNames)` when the roster is non-empty (falling back to
     the current unconstrained string array when empty). Zod v4 `toJSONSchema`
     (used by `generateStructuredOutput`) emits the enum for strict mode.
   - Keep exporting the static `parsedStorySchema` for the E2E fake
     (`createE2eAiActions` parses the fixture roster-free) and for
     `ParsedStory` typing.
   - `openAIStoryToData` (`src/server/ai/openai/story-to-data.ts`) builds the
     schema from `input.characters`; the `StoryToData` port contract is
     unchanged (names in, names out).

2. **Lossless name resolution** (`src/server/domain/pageOps.ts`)
   - Resolve names via normalized comparison (trim + case-fold) instead of
     exact `Map.get`.
   - `parsedStoryToPages` also returns the unmatched names it had to drop
     (should now be near-impossible); `runParseStoryTask` includes
     `unmatchedCharacterNames` in the step response so a recurrence is
     visible in the task log instead of silent.

3. **Parse prompt tuning** (`src/server/ai/prompts/story-to-data.ts`)
   - Keep the scene-only guidance, add: aim for a good mix rather than all
     scene-only; when people appear keep the group small; use roster names
     EXACTLY as listed; map a first-person narrator ("I"/"me") to the roster
     character the story is for (inferable from role/description) when one
     exists. Update `prompts.test.ts` accordingly.

4. **Characters-first flow: relocate the parse action** (UI only)
   - Remove "Parse into pages" from the Script screen
     (`src/components/story/ScriptEditor.tsx`); the Script step becomes
     write/save only, with its CTA pointing to the Characters step.
   - The parse action (same `story.parse` mutation, same `ParseState`
     machinery — extract the existing `useScriptEditor` parse logic into a
     reusable hook rather than duplicating it) moves to the **Characters
     screen** as its primary CTA: "Parse into pages" once a script exists,
     alongside the existing character/rule management. Re-parse (and the
     template re-parse warning) moves with it.
   - If the roster is empty when the user parses, show a confirmation dialog:
     "No characters are defined — every page will be illustrated without
     people. Parse anyway, or add characters first?" Proceed / cancel.
     (Read `docs/styling.md` before building the dialog; reuse the existing
     confirm pattern if one exists.)
   - `deriveStepStates` (`src/lib/steps.ts`): no ordering change needed
     (Characters already precedes Pages); adjust step `done`/`enabled`
     semantics only if the parse relocation makes the current definitions
     read wrong (e.g. Characters step "done" may now also reflect parsed
     state). Keep the pure model in sync with the UI.

5. **Character override at the point of generation**
   (`src/components/pages/PageFocusEditor.tsx` + children)
   - Add a compact character chip row in the image column, directly above the
     Generate/steering controls: one chip per roster character, selected =
     will appear, tap to toggle (wired to the existing `onToggleCharacter`).
     Chips reflect **effective** IDs (post-rules, the existing
     `effectiveCharacterIds`), with a subtle marker on chips added by a rule
     so users see why someone they didn't pick will be drawn.
   - Empty selection state reads "Scene only — no people on this page" so the
     scene-only case looks intentional rather than broken.
   - `PageMetaForm`'s existing character section can shrink to avoid two
     full-size copies of the same control (keep whichever placement reads
     better; the chips near Generate are the requirement).
   - Generation continues to read IDs server-side at task time — no new
     mutation path; toggling a chip persists via `page.update` exactly as the
     current toggles do.

6. **Docs**
   - `docs/ai.md`: update the `storyToData` action entry — output schema is
     roster-constrained per request; prompt guidance changed; fake unchanged
     in shape. Same change, same PR, per the AI-docs rule.

## Tests

(All network-free per the testing rules: in-memory repos, `createFakeAiActions`.)

- **Unit**
  - `schemas`: `buildParsedStorySchema` — enum present with roster, absent
    without; rejects off-roster names; JSON-schema output contains the enum.
  - `pageOps`: normalized resolution (case/whitespace variants resolve; true
    misses reported as unmatched, not silently dropped).
  - `prompts.test.ts`: updated parse-prompt assertions (mix guidance,
    exact-name instruction, narrator mapping only when roster non-empty).
- **Integration** (`src/server/__tests__/`)
  - parseStory: fake returns names with different casing/whitespace → pages
    get correct `characterIds`; fake returns an unknown name → page saved
    without it and `unmatchedCharacterNames` present in the task response.
  - pageImage: unchanged behavior re-asserted — empty IDs ⇒ "NO people"
    prompt branch; non-empty ⇒ cast + roster lines (mostly existing
    coverage; extend as needed).
- **E2E** (`e2e/specs/`, existing parse/pages specs extended)
  - Happy path reordered: write script → Script screen CTA leads to
    Characters → add characters → "Parse into pages" from the Characters
    screen → pages exist with the fixture's character assignments. (Existing
    parse specs and `e2e/support/story.ts` helpers updated for the new
    button location.)
  - Zero-character story: parsing from the Characters screen shows the
    confirmation dialog; confirming proceeds; pages render scene-only
    without errors.
  - Focus editor: chip row visible above Generate; toggling a chip on, then
    generating, results in a page image request (fake) and the chip state
    persists across reload. Fixture `parse-result.json` continues to parse
    against the static schema.

## Files created/changed

- `docs/plans/open/20-flexible-page-characters.md` (this file)
- `src/server/domain/schemas.ts`, `src/server/domain/pageOps.ts`
- `src/server/ai/openai/story-to-data.ts`,
  `src/server/ai/prompts/story-to-data.ts`
- `src/server/inngest/functions/parseStory.ts` (unmatched-name reporting)
- `src/components/story/ScriptEditor.tsx` / `ScriptScreen.tsx` (parse action
  removed), characters screen components (parse CTA added), shared parse
  hook, `src/lib/steps.ts` (only if step semantics need adjusting)
- `src/components/pages/PageFocusEditor.tsx` (+ chip component)
- `docs/ai.md`
- Tests as listed above

No schema/migration changes; no new env vars; no new AI actions or providers.

## Acceptance criteria

- Manual: the flow leads through Characters before any parse — the Script
  screen no longer offers parsing, and the Characters screen does. A story
  with characters, written in first person, parses with a visible mix — some
  pages scene-only, some with the right characters — and those characters
  render in generated page images, not just the cover. Off-roster names
  cannot occur (schema-enforced). Parsing a zero-character story requires
  explicit confirmation. In the focus editor the user can see
  and change exactly who will be drawn immediately before hitting Generate,
  including seeing rule-added characters, and an empty selection is labeled
  scene-only.
- Automated: all tests above pass with no real network/DB;
  `npm run test:run`, `npm run build`, lint green; `docs/ai.md` updated in
  the same change.
