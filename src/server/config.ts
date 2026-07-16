import { z } from "zod"

const optionalNonEmptyString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional()
)

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  OPENAI_TOKEN: z.string().min(1),
  BLOB_READ_WRITE_TOKEN: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().url(),
  OPENAI_CHAT_MODEL: z.string().default("gpt-5.5"),
  OPENAI_IMAGE_MODEL: z.string().default("gpt-image-2"),
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

export type Config = Readonly<{
  db: Readonly<{ url: string }>
  openai: Readonly<{ token: string; chatModel: string; imageModel: string }>
  blob: Readonly<{ token: string }>
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
    openai: {
      token: value.OPENAI_TOKEN,
      chatModel: value.OPENAI_CHAT_MODEL,
      imageModel: value.OPENAI_IMAGE_MODEL,
    },
    blob: { token: value.BLOB_READ_WRITE_TOKEN },
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
