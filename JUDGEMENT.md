# Judgement — feature/domain-core

Plan: docs/04-domain-core.md
Verdict: READY

## Blockers
_none_

## Should-fix

- **FREEFORM rules are not surfaced in image prompts** — `src/server/domain/prompts.ts:33` (`buildImagePrompt`). The plan's rules section says FREEFORM rules have "no structural effect; surfaced only in prompts (`buildParseSystemPrompt` / image prompt include the rule text verbatim)". `buildParseSystemPrompt` includes rule text, but `buildImagePrompt` accepts no rules parameter and never renders rule text, so author FREEFORM rules ("all hats are green") are lost for page-image generation. Note the plan is internally inconsistent — its prescribed `buildImagePrompt` signature omits rules — which is why this is not a blocker. Resolve by adding an optional `rules: Rule[]` (or `freeformRuleTexts: string[]`) param to `buildImagePrompt` and appending FREEFORM rule text, plus a test.

- **`insertPage`'s `afterPosition` is silently reinterpreted for out-of-range/cover values** — `src/server/domain/pageOps.ts:22`. Passing `afterPosition: 0` (after the cover) and any negative value both clamp to 0, and values past the end clamp to append. That matches "insert after position N" only for in-range content positions; behavior at the boundaries is untested (the single test uses `afterPosition: 1`). Add boundary tests (0, negative, > length) documenting the intended semantics.

## Nits

- **`parsedStoryToPages` can produce duplicate page ids** — `src/server/domain/pageOps.ts:99`. Ids are derived from the LLM-supplied `page.page` number (`page-${page.page}`); duplicate or repeated page numbers from the model yield colliding ids. Deriving from the array index would be collision-free.
- **Cover prompt with an empty cast still says "Show the listed characters"** — `src/server/domain/prompts.ts:83`. With `characters: []` the cast block is omitted but the cover instruction still references listed characters. Guard the sentence on a non-empty cast.
- **`normalizePositions` keeps only the first COVER page** — `src/server/domain/pageOps.ts:16`. `pages.find` silently drops any additional COVER rows. Probably impossible upstream, but worth a comment or an invariant check.

The plan's deliverables are otherwise fully present: types, Zod schemas (including steering-text limits), all six prompt builders, an idempotent/order-stable rules engine with documented NEVER-last precedence, immutable page operations with the cover pinned at 0, the task state machine (full transition matrix tested, `nextVariant([1,3]) → 4`, `[] → 1`), colocated tests for every exported function, and no framework/Node/env imports in domain code. (I could not re-run `npm run test:run` here — command approval was denied — so the implementer's green-test claim is taken from the change summary; the test code itself reads as consistent with the implementations.)
