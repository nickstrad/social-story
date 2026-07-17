# Plan 04 — Domain Core (pure functions, no framework)

**Depends on:** nothing (pure TS; shares `src/server/domain/types.ts` with plan 01 — if 01 hasn't run, create the types file here and let 01 merge). **Blocks:** 05, 06, 07, 10. Can run in parallel with 01, 02.

## Context

Read `docs/00-overview.md` and **`cli/main.go`** — this plan ports the CLI's core logic to generic, data-driven TypeScript. Everything here is **pure functions on plain data**: no Prisma, no fetch, no Next.js, no env access. The CLI hardcodes one family (Nick/Arielle/Allison/Ezra) and one sibling rule; the web version makes characters and rules **user data**.

`npm i zod` if not present.

## Deliverables — all in `src/server/domain/`

### 1. `types.ts`

Plain types mirroring the DB entities (Story, Character, Rule, Page, PageImage, Task + enums). If plan 01 already created it, extend/reuse.

### 2. `schemas.ts`

Zod schemas: `parsedStorySchema` (title + pages[{page, text, imagePrompt, characterNames[]}]) used for the LLM structured output; input schemas reused by tRPC routers (createStory, updatePage, characterInput, ruleInput, steeringText limits).

### 3. `prompts.ts` — prompt builders (port of the CLI's, generalized)

- `buildStyleContext(opts: { readerDescription?: string })` — the CLI's `styleContext`, with the reader line parameterized (default: calm/clear children's social-story style).
- `buildCastDescription(characters: Character[]): string` — replaces the hardcoded `familyCast`: renders each character's name, role, age, appearance into the "keep these exact and consistent" block. Empty array → ''.
- `buildImagePrompt({ scene, characters, allCharacters, anchored, steeringText })` — port of CLI `buildImagePrompt`: scene-only branch when `characters` empty ("NO people" instruction); otherwise cast block + explicit "exactly these characters" line + `baseSheetInstruction` when `anchored` + user `steeringText` appended as "Additional direction from the author: …".
- `buildBaseSheetPrompt(characters)` — character reference sheet prompt (row, full body, neutral background, match attached photos).
- `buildCoverPrompt({ title, characters, note })` — book-cover prompt (no text drawn in image; title composited later).
- `buildParseSystemPrompt(characters: Character[], rules: Rule[])` — port of the CLI parse system prompt, but the family roster and the siblings-rule paragraph are generated from the user's characters/rules instead of hardcoded.

### 4. `rules.ts` — rules engine (generalizes `pairSiblings`)

- `applyRulesToPage(characterIds: string[], rules: Rule[], allCharacters: Character[]): { characterIds; changed: boolean }`
  - `TOGETHER`: if any of the rule's characterIds present → all present (stable order, append missing).
  - `ALWAYS_INCLUDE`: character added to every page that has any people (not scene-only pages).
  - `NEVER_INCLUDE`: strip the character.
  - `FREEFORM`: no structural effect; surfaced only in prompts (`buildParseSystemPrompt` / image prompt include the rule text verbatim).
  - Must be **idempotent** and order-stable.
- `applyRulesToStory(pages, rules, characters)` → new pages array + count changed.

### 5. `pageOps.ts` — page collection operations

- `normalizePositions(pages)` — cover stays position 0; others renumbered contiguously.
- `insertPage(pages, afterPosition, newPage)`, `removePage(pages, pageId)`, `movePage(pages, pageId, toPosition)`, `setHidden(pages, pageId, hidden)` — all return new arrays.
- `visiblePagesInOrder(pages)` — cover first, then non-hidden by position (used by PDF and the editor).
- `parsedStoryToPages(parsed, characters)` — maps LLM output (character **names**) to Page rows (character **ids**), dropping unknown names; creates the COVER page at position 0 with the story title.

### 6. `taskMachine.ts` — task state machine

- `canTransition(from: TaskStatus, to: TaskStatus): boolean` (PENDING→RUNNING→SUCCEEDED|FAILED; PENDING→FAILED allowed; nothing leaves terminal states).
- `nextVariant(existingVariants: number[]): number` (max+1, port of CLI `nextVariant`).
- `summarizeStoryTasks(tasks)` → `{ pending, running, failed, done }` counts for UI badges.

## Tests (colocated `*.test.ts`, all pure — no mocks needed)

- `prompts.test.ts`: scene-only prompt contains the NO-people line and no cast; peopled prompt lists exactly the given characters; steeringText appears; anchored adds the sheet instruction; cover prompt forbids drawn text.
- `rules.test.ts`: TOGETHER idempotency, order stability, multi-rule composition, NEVER beats ALWAYS (define precedence: NEVER_INCLUDE applied last — document it), scene-only pages untouched by ALWAYS_INCLUDE.
- `pageOps.test.ts`: insert/remove/move/renumber invariants; cover pinned at 0; unknown character names dropped in `parsedStoryToPages`.
- `taskMachine.test.ts`: full transition matrix; `nextVariant` with gaps ([1,3] → 4) and empty ([] → 1).

## Files created

`src/server/domain/{types,schemas,prompts,rules,pageOps,taskMachine}.ts` + colocated tests.

## Acceptance criteria

- 100% of exported functions unit-tested; `npm run test:run` green; no imports from prisma/next/node APIs (enforce by eye or an eslint `no-restricted-imports` rule for `src/server/domain/**`).
