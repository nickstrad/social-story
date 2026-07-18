# Plan 19 — User-uploaded page & cover images

**Depends on:** 10 (page generation), 11 (page editor UI), 14 (private blob security). Interacts with open plan 17 (story templates) — see Context.

## Context

Today the only way to put artwork on a page (or the cover — the cover is just a
`Page` with `kind: COVER`, edited through the same screen) is AI generation via
the `PAGE_IMAGE` task. Users should be able to upload their own image instead,
per page, from the pages editor.

### Design decision: an upload is just another variant

`PageImage` already models multiple variants per page with explicit selection
(`Page.selectedImageId`), and the variant strip already lets users flip between
them. An upload therefore creates a **new `PageImage` variant and auto-selects
it** — exactly what a generation does — rather than destructively replacing
anything. Prior AI variants stay in the strip and remain selectable. This keeps
one mental model, one selection mechanism, and one PDF-export path.

Because nothing is destroyed, the "override confirmation" is a lightweight UI
confirmation shown only when the page already has a selected image, phrased as
"make this the page's image" — not a destructive-action warning.

### Design decision: no AI involvement, no task

Upload is synchronous and deterministic: multipart POST → validate → normalize
(sharp) → caption band → `createPageImageAssets`. No `deps.ai` call, no Inngest
task, no new AI action or fake. `docs/ai.md` gets a one-line note that uploads
bypass the AI boundary entirely.

To avoid racing a generation for the same page, the upload endpoint rejects
with 409 while the page has an active `PAGE_IMAGE` task (same
`hasActiveTask` guard `page.generate` uses), and the UI disables Upload while
`genState` is `queued`/`generating` and disables Generate while an upload is in
flight.

### Design decision: uploads get the same post-processing as generated art

The uploaded file is normalized like reference photos (`sharp`: auto-rotate,
resize to fit within 1024 px, strip metadata, convert to PNG) and then run
through the existing `addCaptionBand` (page text, or story title for the
cover), so uploaded pages look and export identically to generated ones. The
normalized-but-uncaptioned image is stored as the `PAGE_IMAGE_RAW` asset, the
captioned one as `PAGE_IMAGE`, via the existing `createPageImageAssets`
(`src/server/services/assets.ts:200`). Aspect ratio is preserved (fit inside,
no crop or pad).

### Design decision: provenance on `PageImage`

Add `source PageImageSource @default(AI)` (`AI | UPLOAD`) to `PageImage` and
make `promptUsed` nullable (null for uploads; keep original `filename` on the
`Asset` as today). Existing rows default to `AI`, so the migration is
schema-only (no backfill script needed). `source` is surfaced to the client so
the variant strip can badge uploaded variants and the focus editor can label
the current image's origin.

### Interaction with templates (plan 17)

None required. Both one-off and template-instance stories reach the identical
pages screen and this feature applies uniformly. Per plan 17, assets are never
cloned across stories (`Asset.(storyId, userId)` composite FK), so template
instances start without images and users either generate or upload fresh —
uploaded images on a template are _not_ copied into instances, same as
generated ones.

## Scope boundaries (v1)

- Upload lives in the **focus editor only** (the per-page view). No upload from
  the grid thumbnails or bulk toolbar; the grid's "No image yet" placeholder
  can hint "open to generate or upload".
- One file per upload; PNG/JPEG/WebP up to 8 MB (existing `validateUpload`
  limits). No multi-file drop, no paste-from-clipboard, no URL import.
- No cropping/editing UI; normalization is automatic.
- Uploaded variants are deletable/selectable exactly like AI variants — no new
  management UI.

## Deliverables

1. **Schema & migration** (`prisma/schema.prisma`)
   - `enum PageImageSource { AI UPLOAD }`; `PageImage.source` with
     `@default(AI)`; `PageImage.promptUsed` → `String?`.
   - `db-migrate` against dev (requires explicit user approval per
     `docs/database.md`). Schema-only: verify via migration status, generated
     client, tests, build.

2. **Server: upload service** (`src/server/services/page-image-upload.ts`)
   - `uploadPageImage(deps, { userId, storyId, pageId, file })`:
     ownership assertion (same helpers as `page.generate`,
     `src/server/api/routers/page.ts:20`), active-task guard (409-equivalent
     domain error), `validateUpload` (`src/server/domain/upload.ts`), sharp
     normalization (extract the shared pipeline from
     `src/server/services/photo.ts` rather than duplicating it),
     `addCaptionBand` (page text / story title for cover), next-variant
     computation (same as the `PAGE_IMAGE` task), then
     `createPageImageAssets` extended with `source: "UPLOAD"`,
     `promptUsed: null`, using the existing `pageImageKey`/`pageImageRawKey`
     locators (`src/server/services/storage-keys.ts`).

3. **Server: route** (`src/app/api/upload/page-image/route.ts`)
   - Multipart POST (`storyId`, `pageId`, `file`), modeled directly on
     `src/app/api/upload/photo/route.ts` (auth → parse → service → JSON
     `{ imageId, variant, url }`). Map the active-task error to HTTP 409 and
     validation errors to 400 with the same error-shape the photo route uses.
   - Extend `page.listImages` / `clientPageImage`
     (`src/server/services/assets.ts:40`) to include `source`.

4. **UI: upload affordance in the focus editor**
   (read `docs/styling.md` first; buttons use the existing CVA button
   primitive, dropzone/overlay styling stays colocated Tailwind)
   - `src/hooks/usePageImageUpload.ts` — modeled on
     `useCharacterFormController`'s `postMultipart` + client-side
     `validateUpload` + upload state machine (`idle | uploading | failed`).
     On success: invalidate `page.listImages`, toast, clear state.
   - `src/components/pages/PageFocusEditor.tsx` —
     - `MainImage` becomes a drag-and-drop target. Empty state ("No image
       yet") renders as an explicit dropzone: "Generate one, or drag an image
       here / **Upload**".
     - When an image is already selected, dragging over shows a hover overlay;
       dropping (or picking via the Upload button) shows a **confirmation
       overlay** with a preview thumbnail: "Use this image for this page?
       Your previous versions stay in the strip." Confirm → upload; Cancel →
       discard (revoke the blob: preview URL).
     - An **Upload** secondary button sits beside Generate (hidden-input
       `<input type="file" accept="image/png,image/jpeg,image/webp">`), with
       "PNG, JPEG or WebP, up to 8 MB" helper text matching
       `CharacterPhotoField`.
     - Mutual exclusion: Upload disabled while `busy` (generation
       queued/running), Generate disabled while uploading; uploading shows the
       same skeleton treatment `MainImage` uses for generation, labeled
       "Uploading…" so the manual path reads distinctly from "Generating…".
   - `src/components/pages/VariantStrip.tsx` — "Uploaded" badge on
     `source === "UPLOAD"` variants so users can tell manual from AI variants
     at a glance.

5. **Docs**
   - `docs/ai.md`: note under the action catalog that page/cover images can
     also be user-uploaded, bypassing `deps.ai` entirely (no action, no fake).
   - `docs/index.md`: add this plan to the map if plans are listed there.

## Tests

- **Unit** (`src/server/domain/__tests__/`): none beyond existing
  `validateUpload` coverage unless normalization extraction creates a pure
  seam worth testing (variant numbering already covered by task tests).
- **Integration** (`src/server/__tests__/pageImageUpload.int.test.ts`, using
  `inMemoryRepos` + `inMemoryStorage`, no network):
  - upload creates raw + captioned assets, a `PageImage` with
    `source: "UPLOAD"`, `promptUsed: null`, next variant number, and
    auto-selects it while prior variants remain;
  - cover upload captions with the story title;
  - rejected: wrong MIME, oversized file, foreign story/page (ownership),
    active `PAGE_IMAGE` task → 409-mapped error;
  - a subsequent `page.generate` after an upload picks the next variant
    number (fake AI via `createFakeAiActions`).
- **E2E** (`e2e/specs/page-image-upload.spec.ts`, new — the pages screen has
  no E2E spec yet): create story via `e2e/support/story.ts`, open a page in
  the focus editor, upload `e2e/fixtures/images/page-1.png` via
  `setInputFiles`, assert the image renders, the variant strip shows the
  "Uploaded" badge, and the confirmation overlay appears when uploading over
  an existing image. Runs entirely against the E2E server's fakes (upload
  itself needs no AI; `e2eStorage` serves the bytes).

## Files created

- `docs/plans/open/19-page-image-upload.md` (this file)
- `prisma/migrations/<ts>_page_image_source/`
- `src/server/services/page-image-upload.ts`
- `src/app/api/upload/page-image/route.ts`
- `src/hooks/usePageImageUpload.ts`
- `src/server/__tests__/pageImageUpload.int.test.ts`
- `e2e/specs/page-image-upload.spec.ts`

## Acceptance criteria

- Manual: on any page **and the cover**, in both a one-off story and (once
  plan 17 lands) a template instance, a user can drag-and-drop or
  button-upload an image; a confirmation overlay appears when the page already
  has one; the uploaded image becomes the selected variant with prior AI
  variants intact and badged correctly; the PDF export uses the uploaded,
  caption-banded image; upload and generate cannot run concurrently on the
  same page.
- Automated: integration and E2E specs above pass; no test touches a real
  database, OpenAI, or Vercel Blob.
- `npm run test:run`, `npm run build`, lint all green.
