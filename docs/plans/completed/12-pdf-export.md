# Plan 12 — PDF Export + End-to-End Integration Test

**Depends on:** 05, 10, 11. Final plan.

## Context

Read `docs/00-overview.md` and CLI `pdf.go`/`mustPDF`. Assemble the cover + visible pages (each page's **selected** captioned image) into one PDF, stored in blob storage, downloaded by the user. Deterministic — no AI. Runs as a `PDF_EXPORT` task (large stories take time).

## Deliverables

### 1. PDF assembler — `src/server/services/pdf.ts`

- `npm i pdf-lib`.
- `assemblePdf(images: Buffer[]): Promise<Buffer>` — one page per PNG, page sized to the image (points = pixels at 72dpi), image drawn full-bleed. Pure-ish (Buffers in/out, no I/O).
- Pure domain helper in `src/server/domain/pdfPlan.ts`: `planPdf(pages, imagesByPageId): { orderedImageUrls: string[]; missing: { pageId, reason }[] }` — cover first, then `visiblePagesInOrder` (plan 04); a visible page without a selected image goes to `missing`. Unit-test ordering, hidden exclusion, missing detection.

### 2. Task handler — `src/server/inngest/functions/pdfExport.ts`

`registerTaskHandler('PDF_EXPORT', ...)`: run `planPdf`; if `missing.length` → FAILED with a readable list ("page 4 has no image"); else fetch buffers, `assemblePdf`, `storage.put(pdfKey(storyId), buf, 'application/pdf')`, `resultJson: { url, pageCount }`; story.status → READY.

### 3. Router — `src/server/api/routers/pdf.ts`

`pdf.export({ storyId })` → task; `pdf.latest({ storyId })` → last SUCCEEDED export's url. Register in `root.ts`.

### 4. UI — `src/app/(app)/stories/[storyId]/export/page.tsx`

Server component per the Suspense/hydration pattern (plan 03): `prefetch` `story.get` + `pdf.latest`, wrap the client panel in `<HydrateClient>` + `<Suspense fallback={<ExportSkeleton/>}>` + `ErrorBoundary`; `useExport` reads initial data with `useSuspenseQuery`, export-task polling stays plain `useQuery`.

- Dumb `src/components/story/ExportPanel.tsx` (shadcn `Card`, `Alert` for missing pages, `Progress`/`Spinner` while exporting, `Button` for export/download) — props: `readyPages`, `missingPages` (with links back to the editor), `taskState`, `pdfUrl?`, `onExport`. Download = anchor to blob url (opens/downloads PDF).
- Hook `src/hooks/useExport.ts` — computes readiness via `planPdf`-equivalent pure client helper `exportReadiness(pages)` in `src/lib/exportReadiness.ts` (unit-test), fires export, polls task.

### 5. End-to-end integration test — `src/server/__tests__/e2e.int.test.ts`

> **Testing-policy update (supersedes the "real test DB" wording below).** Per
> the project rule in `CLAUDE.md` (§ Testing), no test may touch a real DB or
> external API — the capstone runs entirely on `inMemoryRepos` + `inMemoryStorage`
>
> - fakes, and "sign-up user" is a constructed session user passed to
>   `createTestCaller`. Real Postgres is reserved for the Playwright E2E suite
>   (plan 13).

The capstone merge test, all through tRPC callers + `immediateDispatcher` + fakes (TextGenerator canned parse, fake ImageGenerator, in-memory storage, in-memory repos):
sign-up user → create story → add 2 characters + TOGETHER rule → parse → base image → bulk generate all pages → hide one page → export PDF → assert PDF buffer starts with `%PDF`, page count = visible pages (cover included, hidden excluded), and a mid-flow export before images fails with the missing list.

## Files created

`src/server/services/pdf.ts` (+test: 2 tiny PNGs → 2-page PDF, dimensions match), `src/server/domain/pdfPlan.ts` (+test), `src/server/inngest/functions/pdfExport.ts`, `src/server/api/routers/pdf.ts`, `src/lib/exportReadiness.ts` (+test), `src/components/story/ExportPanel.tsx`, `src/hooks/useExport.ts`, export page.

## Acceptance criteria

- E2E integration test green; manual full flow produces a downloadable PDF.
- Full suite `npm run test:run`, `npm run build`, lint — all green. Project complete.
