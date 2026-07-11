# Change summary — feature/pdf-export

Plan: docs/12-pdf-export.md

## What was implemented

- **PDF assembler** — `src/server/services/pdf.ts`: `assemblePdf(images: Buffer[])` builds one page per PNG, each sized to its image (points = px @ 72dpi), full-bleed, via `pdf-lib` (added as a dependency). Pure Buffers-in/Buffer-out. Test: 2 colored PNGs → 2-page `%PDF`, per-page dimensions asserted.
- **Pure ordering domain** — `src/server/domain/pdfPlan.ts`: `planPdf(pages, imagesByPageId)` → `{ orderedImageUrls, missing }`. Cover first, then `visiblePagesInOrder`; a visible page whose selected image is absent goes to `missing`; hidden pages excluded. Unit-tested (ordering, hidden exclusion, missing/stale-selection detection).
- **Task handler** — `src/server/inngest/functions/pdfExport.ts`: `registerTaskHandler("PDF_EXPORT", …)`. Runs `planPdf`; if anything is missing → FAILED with a readable list ("Cannot export: the cover, page 2 has no image"); else fetches buffers (parallel), `assemblePdf`, `storage.put(storyPdfKey, …, "application/pdf")`, sets `story.status = "READY"`, returns `{ url, pageCount }`. Registered via side-effect import in `functions/index.ts`.
- **Router** — `src/server/api/routers/pdf.ts`: `pdf.export({ storyId })` (guards a second concurrent export with `hasActiveTask`, mirroring `story.parse`/`page.generate`) and `pdf.latest({ storyId })` (last SUCCEEDED export's url). Registered in `root.ts`.
- **UI** — `src/app/(app)/stories/[storyId]/export/page.tsx` (server component: prefetch `story.get` + `pdf.latest`, `HydrateClient` + `Suspense` + `ErrorBoundary`), `ExportScreen` (wires hook → panel, renders `StoryStepsNav current="export"`), dumb `ExportPanel` (Card, Alert listing missing pages with links back to `/pages?focus=…`, Spinner while exporting, export + download-anchor buttons), `ExportSkeleton`, and `useExport` hook (suspense reads, task polling, toasts on transition). Pure client helper `src/lib/exportReadiness.ts` (`exportReadiness(pages)` → ready/missing/canExport) with unit tests.
- **Capstone e2e** — `src/server/__tests__/e2e.int.test.ts`: full flow through tRPC callers + `immediateDispatcher` + fakes — create story → 2 characters + TOGETHER rule → parse → base image → mid-flow export fails with the missing list → bulk-generate all → hide one page → export → assert PDF starts with `%PDF`, `pageCount === 2` (cover + 1 visible; hidden excluded), story `READY`.

## What /simplify changed

Four parallel review agents (reuse / simplification / efficiency / altitude); applied:

- `src/lib/exportReadiness.ts` — removed the redundant `contentOrder` array and the per-iteration `pages.find`. Labels now use the already-normalized `page.position` (same number the server error uses → one algorithm across client/server, resolving the altitude finding), and URL lookup uses a prebuilt Map. Two O(n²) scans → O(n).
- `src/server/domain/taskMachine.ts` — added `isActiveStatus(status)` (the canonical PENDING||RUNNING test); `isActiveTask` now delegates to it. Used by the new `ExportPanel` and `useExport` instead of open-coded status checks.
- `src/server/api/routers/pdf.ts` — replaced the hand-rolled `resultJson` narrowing with a zod `safeParse`.
- `src/hooks/useExport.ts` — dropped the unused `canExport` from the hook's return (the panel derives its own, since it also needs `busy`).

Skipped (noted, not applied): extracting a shared `latestTaskOfType` across `useBaseImage`/`usePageGeneration`/`useExport` and a shared `readResultField` getter — both span pre-existing files outside this diff and are low-value; the sequential `embedPng` loop in `pdf.ts` is intentional (single shared mutable `PDFDocument`, CPU-bound).

## Notes for review

- **Testing policy / real DB.** The plan's wording ("real test DB") and every existing `*.int.test.ts` sibling use real Postgres guarded by `skipIf(!DATABASE_URL)`, and "sign-up user" would need real Better Auth. Per explicit user direction mid-implementation ("no testing ever hits the real db"), the capstone was written entirely against `inMemoryRepos` + `inMemoryStorage` + fakes (always runs, ~0.4s, no network); "sign-up" is a constructed session user passed to `createTestCaller`. This policy was also recorded in `CLAUDE.md` (a new **# Testing** section; `AGENTS.md` is a symlink to it). The pre-existing real-DB int tests were left untouched — bringing them in line with the new policy is a separate follow-up, out of this plan's scope.
- `src/server/inngest/functions/index.test.ts` — its "no registered handler" case used `PDF_EXPORT` as the example unhandled type; now that PDF_EXPORT is registered, it uses a cast `"UNKNOWN_TYPE"` instead.
- `storyPdfKey` already existed in `storage-keys.ts` (defined by an earlier plan) and was reused as-is.

## Judge feedback addressed

Judge verdict was **READY** (no blockers). Polish applied:

- `pdfExport.ts` failure message — verb now agrees with count ("page 2 has" vs "pages 2, 3 have"), and an unresolved `pageId` falls back to "an unknown page" instead of "page undefined".
- `docs/12-pdf-export.md` — added a note at the e2e section recording the testing-policy change (in-memory, no real DB) that supersedes the plan's original "real test DB" wording, so the doc and the test no longer diverge.
- Skipped: the `latestExportTask` / `pdf.latest` reduce duplication (third copy) — already a documented, accepted skip (spans pre-existing files, low value).

## Verification

`npm run test:run` (163 passed), `npx tsc --noEmit`, `npm run lint`, `npm run build` — all green. The `/stories/[storyId]/export` route builds.
