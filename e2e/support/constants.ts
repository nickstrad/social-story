// Shared E2E harness constants. None of these are secrets: the OpenAI/Blob
// tokens are dummies (config requires them but the fakes never call out), and
// the auth secret is a fixed test value. Real secrets live only in `.env`, which
// the E2E suite deliberately does not use.
export const E2E_DATABASE_URL =
  "postgresql://e2e:e2e@localhost:5433/social_story_e2e"

export const BASE_URL = "http://localhost:3000"

/** Environment the app process runs with under Playwright's `webServer`. */
export const serverEnv: Record<string, string> = {
  E2E_FAKES: "1",
  NODE_ENV: "production",
  DATABASE_URL: E2E_DATABASE_URL,
  OPENAI_TOKEN: "e2e-dummy-openai-token",
  BLOB_READ_WRITE_TOKEN: "e2e-dummy-blob-token",
  BETTER_AUTH_SECRET: "e2e-better-auth-secret-at-least-32-chars-long",
  BETTER_AUTH_URL: BASE_URL,
}
