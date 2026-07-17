import { z } from "zod"

const optionalNonEmptyString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional()
)

// When you add a required var or new branching here, mirror it in
// `testConfigEnv()` below (fake value, or neutralized branch) or the server
// test suite will fail to import. See the Testing section of the root CLAUDE.md.
const envSchema = z
  .object({
    DATABASE_URL: z.string().url(),
    OPENAI_TOKEN: z.string().min(1),
    BLOB_READ_WRITE_TOKEN: optionalNonEmptyString,
    BLOB_STORE_ID: optionalNonEmptyString,
    VERCEL_OIDC_TOKEN: optionalNonEmptyString,
    BETTER_AUTH_SECRET: z.string().min(1),
    BETTER_AUTH_URL: z.string().url(),
    OPENAI_CHAT_MODEL: z.string().default("gpt-5.5"),
    OPENAI_IMAGE_MODEL: z.string().default("gpt-image-2"),
    AI_STORY_TO_DATA_PROVIDER: z.enum(["openai"]).default("openai"),
    AI_STORY_TO_DATA_MODEL: optionalNonEmptyString,
    AI_CHARACTER_PHOTO_AUTOFILL_PROVIDER: z.enum(["openai"]).default("openai"),
    AI_CHARACTER_PHOTO_AUTOFILL_MODEL: optionalNonEmptyString,
    AI_BASE_IMAGE_PROVIDER: z.enum(["openai"]).default("openai"),
    AI_BASE_IMAGE_MODEL: optionalNonEmptyString,
    AI_PAGE_IMAGE_PROVIDER: z.enum(["openai"]).default("openai"),
    AI_PAGE_IMAGE_MODEL: optionalNonEmptyString,
    AI_COVER_IMAGE_PROVIDER: z.enum(["openai"]).default("openai"),
    AI_COVER_IMAGE_MODEL: optionalNonEmptyString,
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    // Playwright E2E switch. When "1", the container swaps every external adapter
    // (LLM, blob storage, background dispatch) for a deterministic fake while the
    // database, auth, and tRPC stay real. Off by default — never implied in prod.
    E2E_FAKES: z.enum(["0", "1"]).default("0"),
    NEXT_PHASE: z.string().optional(),
    INNGEST_DEV: z.enum(["0", "1"]).optional(),
    INNGEST_EVENT_KEY: optionalNonEmptyString,
    INNGEST_SIGNING_KEY: optionalNonEmptyString,
    INNGEST_SIGNING_KEY_FALLBACK: optionalNonEmptyString,
  })
  .superRefine((env, ctx) => {
    const hasOidcPair = Boolean(env.BLOB_STORE_ID && env.VERCEL_OIDC_TOKEN)
    if (hasOidcPair || env.BLOB_READ_WRITE_TOKEN) return
    const hasPartialOidc = Boolean(env.BLOB_STORE_ID || env.VERCEL_OIDC_TOKEN)
    ctx.addIssue({
      code: "custom",
      message: hasPartialOidc
        ? "BLOB_STORE_ID and VERCEL_OIDC_TOKEN must be set together"
        : "OIDC credentials or BLOB_READ_WRITE_TOKEN are required",
      path: [hasPartialOidc ? "BLOB_STORE_ID" : "BLOB_READ_WRITE_TOKEN"],
    })
  })

export type Config = Readonly<{
  db: Readonly<{ url: string }>
  openai: Readonly<{ token: string }>
  ai: Readonly<{
    storyToData: AiActionBinding
    characterPhotoAutofill: AiActionBinding
    baseImage: AiActionBinding
    pageImage: AiActionBinding
    coverImage: AiActionBinding
  }>
  blob: Readonly<{ storeId: string; oidcToken: string } | { token: string }>
  auth: Readonly<{ secret: string; url: string }>
  inngest: Readonly<{
    isDev: boolean
    eventKey?: string
    signingKey?: string
    signingKeyFallback?: string
  }>
  env: "development" | "test" | "production"
  e2eFakes: boolean
}>

export type AiActionBinding = Readonly<{
  provider: "openai"
  model: string
}>

export function parseConfig(env: Record<string, string | undefined>): Config {
  const result = envSchema.safeParse(env)
  if (!result.success) {
    const flattened = result.error.flatten().fieldErrors
    const details = Object.entries(flattened)
      .map(([key, messages]) => `${key}: ${messages?.join(", ")}`)
      .join("; ")
    throw new Error(`Invalid environment configuration: ${details}`)
  }

  const value = result.data
  const inngestDev =
    value.INNGEST_DEV === undefined
      ? value.NODE_ENV !== "production"
      : value.INNGEST_DEV === "1"
  const requiresHostedInngest =
    value.NODE_ENV === "production" &&
    value.E2E_FAKES === "0" &&
    value.NEXT_PHASE !== "phase-production-build" &&
    !inngestDev
  if (requiresHostedInngest) {
    const missing = [
      !value.INNGEST_EVENT_KEY && "INNGEST_EVENT_KEY",
      !value.INNGEST_SIGNING_KEY && "INNGEST_SIGNING_KEY",
    ].filter((key): key is string => Boolean(key))
    if (missing.length > 0) {
      throw new Error(
        `Invalid environment configuration: ${missing.join(", ")} required in production`
      )
    }
  }
  return {
    db: { url: value.DATABASE_URL },
    openai: { token: value.OPENAI_TOKEN },
    ai: {
      storyToData: {
        provider: value.AI_STORY_TO_DATA_PROVIDER,
        model: value.AI_STORY_TO_DATA_MODEL ?? value.OPENAI_CHAT_MODEL,
      },
      characterPhotoAutofill: {
        provider: value.AI_CHARACTER_PHOTO_AUTOFILL_PROVIDER,
        model:
          value.AI_CHARACTER_PHOTO_AUTOFILL_MODEL ?? value.OPENAI_CHAT_MODEL,
      },
      baseImage: {
        provider: value.AI_BASE_IMAGE_PROVIDER,
        model: value.AI_BASE_IMAGE_MODEL ?? value.OPENAI_IMAGE_MODEL,
      },
      pageImage: {
        provider: value.AI_PAGE_IMAGE_PROVIDER,
        model: value.AI_PAGE_IMAGE_MODEL ?? value.OPENAI_IMAGE_MODEL,
      },
      coverImage: {
        provider: value.AI_COVER_IMAGE_PROVIDER,
        model: value.AI_COVER_IMAGE_MODEL ?? value.OPENAI_IMAGE_MODEL,
      },
    },
    blob:
      value.BLOB_STORE_ID && value.VERCEL_OIDC_TOKEN
        ? {
            storeId: value.BLOB_STORE_ID,
            oidcToken: value.VERCEL_OIDC_TOKEN,
          }
        : { token: value.BLOB_READ_WRITE_TOKEN! },
    auth: { secret: value.BETTER_AUTH_SECRET, url: value.BETTER_AUTH_URL },
    inngest: {
      isDev: inngestDev,
      eventKey: value.INNGEST_EVENT_KEY,
      signingKey: value.INNGEST_SIGNING_KEY,
      signingKeyFallback: value.INNGEST_SIGNING_KEY_FALLBACK,
    },
    env: value.NODE_ENV,
    e2eFakes: value.E2E_FAKES === "1",
  }
}

let config: Config | undefined

export function getConfig(): Config {
  config ??= parseConfig(process.env)
  return config
}

// Fake, non-secret env that satisfies `envSchema`, for the server test suite.
// Lives next to the schema so a new required var is added here in the same
// change. Applied to `process.env` by `vitest.setup.server.ts` before any
// server module imports — tests never run against real credentials, so a real
// `.env` (e.g. one copied into a worktree) is deliberately overridden. These
// are never real values; keep it that way.
export function testConfigEnv(): Record<string, string> {
  return {
    DATABASE_URL: "postgres://test:test@localhost:5432/test",
    OPENAI_TOKEN: "test-openai-token",
    BETTER_AUTH_SECRET: "test-better-auth-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    // config prefers the OIDC pair (BLOB_STORE_ID + VERCEL_OIDC_TOKEN) over
    // BLOB_READ_WRITE_TOKEN, so clear the pair and force the token path.
    BLOB_STORE_ID: "",
    VERCEL_OIDC_TOKEN: "",
    BLOB_READ_WRITE_TOKEN: "test-blob-token",
  }
}
