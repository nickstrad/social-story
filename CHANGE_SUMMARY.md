# Change summary — feature/auth

Plan: docs/02-auth.md

## What was implemented

- Added Better Auth with the Prisma adapter, centralized auth config, and the Next.js catch-all route handler.
- Added a single server session helper and protected `(app)` layout with a placeholder `/stories` page.
- Added the React auth client, email/password validation, sign-in and sign-up hooks, stateless forms, and sign-out header flow.
- Added unit tests for validation and form behavior plus a real-database integration test covering sign-up, sign-in, persisted users, cookies, and server session resolution.
- Ran the Better Auth schema generator and compared its output with the existing Prisma models. Fields match; the generator's lowercase table mappings and alternate unique-constraint syntax do not require a corrective migration because the adapter uses the existing Prisma model mapping.

## What /simplify changed

- Centralized the hook's sign-in/sign-up dispatch in a small helper.
- Made submission cleanup unconditional and added a clear recoverable error for network failures so the form cannot remain stuck in a submitting state.
- Kept UI components stateless and isolated client orchestration in hooks and the small app shell.

## Notes for review

- Synced the worktree with the merged `feature/openai-service` work, including its `OPENAI_TOKEN` config rename.
- `npm run test:run` passes all 54 tests, including the Neon-backed auth and repository integration tests.
- TypeScript, ESLint, and the production Next.js build pass. The build requires network access for the scaffold's Google-hosted Geist fonts and warns about multiple lockfiles because this branch intentionally lives in a worktree.
