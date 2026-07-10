# Judgement — feature/auth

Plan: docs/02-auth.md
Verdict: NOT READY

## Blockers

- **Missing `.env.example`** — `.env.example` (absent from diff). The plan's deliverable 1 explicitly requires adding `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL` placeholders to a new `.env.example`, and it's listed in "Files created". The diff contains no `.env.example`. Create it with placeholder entries for the auth keys (and any other config-module variables), without touching `.env`.

## Should-fix

- **Sign-out failure leaves the header stuck in "Signing out"** — `src/hooks/useSignOut.ts:13-17`. `await signOut()` has no try/catch/finally; a network failure rejects and leaves `isSigningOut` permanently `true`, disabling the button with no recovery. Wrap in try/finally (and surface or swallow the error), mirroring the recoverable-error handling already added to `useAuthForm`.

## Nits

- **`error.flatten()` is deprecated in zod v4** — `src/lib/validation/auth.ts:27`. The project resolves zod ^4 (per better-auth's dependency tree); `flatten()` still works but is deprecated in favor of `z.treeifyError()`/`z.flattenError()`. Consider switching to avoid a future break.
- **Invalid-input hook test only covers signin** — `src/hooks/useAuthForm.test.tsx:44-53`. A signup-mode invalid case (e.g. empty name) would also exercise the mode-dependent branch of `validateAuthInput` through the hook. Plan's minimum is met, so nit only.
