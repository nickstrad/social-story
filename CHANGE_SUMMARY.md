# Change summary — feature/domain-core

Plan: docs/04-domain-core.md

## What was implemented

- Added plain domain entity and enum types mirroring the planned persistence model.
- Added reusable Zod schemas for parsed stories and future story, page, character, rule, and steering-text router inputs.
- Ported and generalized the CLI prompt builders for reader style, dynamic casts, page images, reference sheets, covers, and structured story parsing.
- Added an idempotent, stable rules engine with composable TOGETHER rules, scene-aware ALWAYS_INCLUDE behavior, final NEVER_INCLUDE precedence, and story-level change counts.
- Added immutable page insertion, removal, movement, visibility, normalization, and parsed-story conversion operations with the cover pinned at position zero.
- Added task transition, variant, and status-summary helpers.
- Added 24 colocated unit tests across six suites and the `test:run` package script.
- Added Zod as a direct runtime dependency.

## What /simplify changed

- Centralized page cover/position normalization shared by insert and move operations, removing duplicated reindexing code while preserving behavior.

## Judge feedback applied

- Added optional FREEFORM rules to page-image prompts and verified their text is included verbatim without surfacing structural rules.
- Documented insertion boundary behavior through tests for zero, negative, and past-the-end positions.
- Made parsed page IDs collision-free when model-supplied page numbers repeat.
- Added accurate people-free wording for cover prompts with an empty cast.
- Made duplicate covers an explicit collection invariant error instead of silently discarding extras.

## Notes for review

- `npm run test:run`, `npx tsc --noEmit`, `npm run lint`, and `npm run build` pass.
- The production build emits the repository's existing multi-lockfile workspace-root warning because this branch intentionally lives in a git worktree.
- Domain source imports only Zod and local type/modules; it has no Prisma, Next.js, Node API, environment, or fetch dependency.
