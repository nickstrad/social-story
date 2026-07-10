import { z } from "zod"

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
})

export type Config = Readonly<{
  db: Readonly<{ url: string }>
  openai: Readonly<{ token: string; chatModel: string; imageModel: string }>
  blob: Readonly<{ token: string }>
  auth: Readonly<{ secret: string; url: string }>
  env: "development" | "test" | "production"
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
  return {
    db: { url: value.DATABASE_URL },
    openai: {
      token: value.OPENAI_TOKEN,
      chatModel: value.OPENAI_CHAT_MODEL,
      imageModel: value.OPENAI_IMAGE_MODEL,
    },
    blob: { token: value.BLOB_READ_WRITE_TOKEN },
    auth: { secret: value.BETTER_AUTH_SECRET, url: value.BETTER_AUTH_URL },
    env: value.NODE_ENV,
  }
}

let config: Config | undefined

export function getConfig(): Config {
  config ??= parseConfig(process.env)
  return config
}
