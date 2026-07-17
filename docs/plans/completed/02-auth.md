# Plan 02 — Authentication (Better Auth, email + password)

**Depends on:** 01 (Prisma schema + `src/server/db.ts`). **Blocks:** 03. Can run in parallel with 04, 06.

## Context

Read `docs/00-overview.md`. Prisma schema already contains Better Auth's `User/Session/Account/Verification` models from plan 01. **Read `node_modules/next/dist/docs/` for App Router route-handler and middleware conventions before writing code**, and consult Better Auth's current docs (it moves fast).

## Deliverables

### 1. Server auth instance — `src/server/auth.ts`

- `npm i better-auth`.
- `betterAuth({ database: prismaAdapter(db, { provider: 'postgresql' }), emailAndPassword: { enabled: true }, ... })`.
- `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL` come from `getConfig().auth` (`src/server/config.ts`, plan 01 — already in its schema); do NOT read `process.env` here. Add placeholders to a new `.env.example` (never touch `.env` values, only append missing keys if absent).
- Run `npx @better-auth/cli generate` and diff against `prisma/schema.prisma`; if fields differ from plan 01's guess, create a corrective migration.

### 2. Route handler — `src/app/api/auth/[...all]/route.ts`

Mount Better Auth's Next.js handler (`toNextJsHandler(auth)` or current equivalent).

### 3. Client — `src/lib/auth-client.ts`

`createAuthClient()` from `better-auth/react`; export `signIn`, `signUp`, `signOut`, `useSession`.

### 4. Session helper for the server — `src/server/auth-session.ts`

`getServerSession(headers)` wrapper returning `{ user } | null` — this is what tRPC context (plan 03) will call. Keep it the single point of session resolution.

### 5. UI — dumb components + hooks pattern

- `src/components/auth/AuthForm.tsx` — **stateless** form (props: `mode: 'signin'|'signup'`, `values`, `errors`, `isSubmitting`, `onChange`, `onSubmit`). Pure layout built from shadcn primitives (`Card`, `Field`/`Label`, `Input`, `Button`, `Spinner`; errors via `Alert` or field messages) — already in `src/components/ui/`.
- `src/hooks/useAuthForm.ts` — holds field state, zod validation (`src/lib/validation/auth.ts`: email/password schemas as pure zod exports), calls auth-client, redirects to `/stories` on success. Extract `validateAuthInput(values, mode)` as a pure function.
- Pages: `src/app/(auth)/signin/page.tsx`, `src/app/(auth)/signup/page.tsx` — thin wiring of hook → component.
- Route protection: `src/app/(app)/layout.tsx` server layout that calls `getServerSession` and redirects to `/signin` when absent. All app pages from later plans live under `(app)/`.
- Simple header with user email + sign-out button: dumb `src/components/layout/AppHeader.tsx` + `src/hooks/useSignOut.ts`.

## Tests

- `src/lib/validation/auth.test.ts` — unit tests for `validateAuthInput` (bad email, short password, ok).
- `src/hooks/useAuthForm.test.tsx` — `renderHook` from `@testing-library/react` (already installed; jsdom is the default vitest environment) with a mocked auth-client: submit valid → client called; invalid → errors set, client not called.
- `src/server/__tests__/auth.int.test.ts` — integration: call the Better Auth API directly (`auth.api.signUpEmail`, `signInEmail`) against the test DB; assert user row exists and session resolves via `getServerSession`. Skip if no `DATABASE_URL`.

## Files created

`src/server/auth.ts`, `src/server/auth-session.ts`, `src/app/api/auth/[...all]/route.ts`, `src/lib/auth-client.ts`, `src/lib/validation/auth.ts` (+test), `src/components/auth/AuthForm.tsx`, `src/components/layout/AppHeader.tsx`, `src/hooks/useAuthForm.ts` (+test), `src/hooks/useSignOut.ts`, `src/app/(auth)/signin/page.tsx`, `src/app/(auth)/signup/page.tsx`, `src/app/(app)/layout.tsx`, `.env.example`.

## Interfaces exposed to other plans

- `getServerSession(headers)` (plan 03 tRPC context).
- `(app)/` route group layout (all authed pages).

## Acceptance criteria

- Manual: sign up, sign out, sign in works locally (`npm run dev`); `/stories` (placeholder page ok) redirects when logged out.
- All tests green; build + lint pass.
