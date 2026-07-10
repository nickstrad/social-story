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
      env: "development",
    })
  })

  it("reports multiple errors together", () => {
    expect(() =>
      parseConfig({ ...validEnv, DATABASE_URL: "invalid", OPENAI_TOKEN: "" })
    ).toThrow(/DATABASE_URL.*OPENAI_TOKEN/)
  })
})
