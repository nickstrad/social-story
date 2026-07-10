# Change summary — feature/characters-rules

Plan: docs/08-characters-rules.md

## What was implemented

- Added authenticated photo uploads with ownership checks, pure MIME/size validation, Sharp PNG normalization, Vercel Blob storage, and character photo URL persistence.
- Added ownership-safe character and rule tRPC CRUD, structured rule validation, photo deletion, and character-reference cleanup across rules.
- Added the Suspense-prefetched characters route, controlled character/rule hooks, dumb shadcn-based cards and forms, dialogs, delete confirmations, image placeholders, and mutation toasts.
- Added readable rule descriptions and configured `next/image` for Vercel Blob hosts.
- Added unit, hook, and real-Prisma integration coverage for upload validation, rule text/schema edges, form behavior, CRUD, blob cleanup, rule cleanup, and cross-user access.

## What /simplify changed

- Extracted the selected-record deletion branch from the screen render path.
- Reused query invalidation and refreshed character data after photo uploads so new thumbnails appear immediately.
- Kept validation and ownership checks centralized in shared schemas/helpers instead of duplicating them in UI and router branches.

## Judge feedback addressed

- Rendered a live photo thumbnail in `CharacterForm` driven by `photoPreviewUrl` (Should-fix).
- Wired `imagePending` through `CharactersScreen`: `CharacterEditor` surfaces the uploading character's id via `onUploadingChange`, so the matching card shows the upload skeleton (Should-fix).
- Not applied — deleting rules that fall below their structural minimum on character delete: this conflicts with the plan's mandated cleanup (keep the rule, drop the id) and its integration test; the judge flagged it as an acceptable nit, so left as-is.
- Not applied — `describeRule` empty-`characterIds` fallback wording: unreachable through validated input; left as a nit.
- Not applied — drag-and-drop dropzone: file input satisfies the flow; left as a nit.

## Notes for review

- No known deviations or open implementation issues.
- Verification passed: TypeScript, ESLint, all 69 tests, and the Next.js production build.
