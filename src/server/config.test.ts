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
      openai: { chatModel: "gpt-5.5", imageModel: "gpt-image-2" },
      inngest: { isDev: true },
      env: "development",
    })
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
