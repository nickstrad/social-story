// Shared E2E harness constants. None of these are secrets: the OpenAI/Blob
// tokens are dummies (config requires them but the fakes never call out), and
// the auth secret is a fixed test value. Real secrets live only in `.env`, which
// the E2E suite deliberately does not use.
export const E2E_DATABASE_URL =
  "postgresql://e2e:e2e@localhost:5433/social_story_e2e"

// Deliberately NOT 3000: `next dev` owns that port, and a dev server runs with
// the real `.env` — real OpenAI, real Vercel Blob, the dev database. Playwright
// reuses whatever already answers on this URL, so pointing the suite at 3000
// silently hands the whole run to that dev server and drops `serverEnv` (fakes
// included) on the floor. A private port keeps E2E on its own process.
//
// `scripts/e2e.sh` exports E2E_PORT before pre-flighting that the port is free,
// so its value wins and the guard can never check a different port than the one
// the server binds. The literal is the fallback for a direct `playwright test`.
export const E2E_PORT = process.env.E2E_PORT ?? "3100"

export const BASE_URL = `http://localhost:${E2E_PORT}`

/** Environment the app process runs with under Playwright's `webServer`. */
export const serverEnv: Record<string, string> = {
  E2E_FAKES: "1",
  NODE_ENV: "production",
  PORT: E2E_PORT,
  DATABASE_URL: E2E_DATABASE_URL,
  OPENAI_TOKEN: "e2e-dummy-openai-token",
  BLOB_READ_WRITE_TOKEN: "e2e-dummy-blob-token",
  BETTER_AUTH_SECRET: "e2e-better-auth-secret-at-least-32-chars-long",
  BETTER_AUTH_URL: BASE_URL,
}
