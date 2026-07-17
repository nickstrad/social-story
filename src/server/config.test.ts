import { describe, expect, it } from "vitest"

import { parseConfig } from "./config"

const validEnv = {
  DATABASE_URL: "https://database.example.com",
  OPENAI_TOKEN: "openai-token",
  BLOB_READ_WRITE_TOKEN: "blob-token",
  BETTER_AUTH_SECRET: "auth-secret",
  BETTER_AUTH_URL: "https://app.example.com",
}

describe("parseConfig", () => {
  it("names a missing required key", () => {
    expect(() => parseConfig({ ...validEnv, DATABASE_URL: undefined })).toThrow(
      "DATABASE_URL"
    )
  })

  it("applies optional defaults", () => {
    expect(parseConfig(validEnv)).toMatchObject({
      openai: { token: "openai-token" },
      ai: {
        storyToData: { provider: "openai", model: "gpt-5.5" },
        characterPhotoAutofill: { provider: "openai", model: "gpt-5.5" },
        baseImage: { provider: "openai", model: "gpt-image-2" },
        pageImage: { provider: "openai", model: "gpt-image-2" },
        coverImage: { provider: "openai", model: "gpt-image-2" },
      },
      inngest: { isDev: true },
      env: "development",
    })
  })

  it("configures each AI action independently", () => {
    expect(
      parseConfig({
        ...validEnv,
        AI_STORY_TO_DATA_MODEL: "story-model",
        AI_CHARACTER_PHOTO_AUTOFILL_MODEL: "vision-model",
        AI_BASE_IMAGE_MODEL: "base-model",
        AI_PAGE_IMAGE_MODEL: "page-model",
        AI_COVER_IMAGE_MODEL: "cover-model",
      }).ai
    ).toEqual({
      storyToData: { provider: "openai", model: "story-model" },
      characterPhotoAutofill: { provider: "openai", model: "vision-model" },
      baseImage: { provider: "openai", model: "base-model" },
      pageImage: { provider: "openai", model: "page-model" },
      coverImage: { provider: "openai", model: "cover-model" },
    })
  })

  it("uses legacy OpenAI models only as fallbacks", () => {
    const config = parseConfig({
      ...validEnv,
      OPENAI_CHAT_MODEL: "legacy-chat",
      OPENAI_IMAGE_MODEL: "legacy-image",
      AI_STORY_TO_DATA_MODEL: "specific-story",
    })
    expect(config.ai.storyToData.model).toBe("specific-story")
    expect(config.ai.characterPhotoAutofill.model).toBe("legacy-chat")
    expect(config.ai.baseImage.model).toBe("legacy-image")
    expect(config.ai.pageImage.model).toBe("legacy-image")
    expect(config.ai.coverImage.model).toBe("legacy-image")
  })

  it("rejects unsupported providers at startup", () => {
    expect(() =>
      parseConfig({ ...validEnv, AI_PAGE_IMAGE_PROVIDER: "openrouter" })
    ).toThrow(/AI_PAGE_IMAGE_PROVIDER/)
  })

  it("prefers a complete OIDC pair without passing the static token", () => {
    expect(
      parseConfig({
        ...validEnv,
        BLOB_STORE_ID: "store-id",
        VERCEL_OIDC_TOKEN: "oidc-token",
      }).blob
    ).toEqual({ storeId: "store-id", oidcToken: "oidc-token" })
  })

  it("falls back to the static token when only part of the OIDC pair exists", () => {
    expect(
      parseConfig({ ...validEnv, BLOB_STORE_ID: "store-id" }).blob
    ).toEqual({ token: "blob-token" })
  })

  it("requires either complete OIDC credentials or a static token", () => {
    expect(() =>
      parseConfig({ ...validEnv, BLOB_READ_WRITE_TOKEN: undefined })
    ).toThrow(/BLOB_READ_WRITE_TOKEN/)
  })

  it("requires Inngest keys in production", () => {
    expect(() =>
      parseConfig({ ...validEnv, NODE_ENV: "production", INNGEST_DEV: "0" })
    ).toThrow(/INNGEST_EVENT_KEY.*INNGEST_SIGNING_KEY/)
  })

  it("defaults production to hosted Inngest and requires keys", () => {
    expect(() => parseConfig({ ...validEnv, NODE_ENV: "production" })).toThrow(
      /INNGEST_EVENT_KEY.*INNGEST_SIGNING_KEY/
    )
  })

  it("defers hosted key validation during a Next production build", () => {
    expect(
      parseConfig({
        ...validEnv,
        NODE_ENV: "production",
        NEXT_PHASE: "phase-production-build",
      }).inngest.isDev
    ).toBe(false)
  })

  it("does not require real keys for the local Inngest Dev Server", () => {
    expect(
      parseConfig({
        ...validEnv,
        INNGEST_DEV: "1",
        INNGEST_EVENT_KEY: "",
        INNGEST_SIGNING_KEY: "",
      }).inngest
    ).toEqual({
      isDev: true,
      eventKey: undefined,
      signingKey: undefined,
      signingKeyFallback: undefined,
    })
  })

  it("accepts hosted Inngest configuration in production", () => {
    expect(
      parseConfig({
        ...validEnv,
        NODE_ENV: "production",
        INNGEST_DEV: "0",
        INNGEST_EVENT_KEY: "event-key",
        INNGEST_SIGNING_KEY: "signing-key",
      }).inngest
    ).toEqual({
      isDev: false,
      eventKey: "event-key",
      signingKey: "signing-key",
      signingKeyFallback: undefined,
    })
  })

  it("reports multiple errors together", () => {
    expect(() =>
      parseConfig({ ...validEnv, DATABASE_URL: "invalid", OPENAI_TOKEN: "" })
    ).toThrow(/DATABASE_URL.*OPENAI_TOKEN/)
  })
})
