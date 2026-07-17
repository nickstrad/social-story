// @vitest-environment node

import { describe, expect, it } from "vitest"

import { AiActionError } from "../errors"
import { mapOpenAIError } from "./errors"
import { OpenAIHttpError } from "./http"

describe("OpenAI error mapping", () => {
  it.each([
    [429, "rate_limited", true],
    [503, "unavailable", true],
    [401, "misconfigured", false],
    [400, "invalid_input", false],
  ] as const)("maps HTTP %i to %s", (status, code, retryable) => {
    const cause = new OpenAIHttpError(status, "provider diagnostic")
    const error = mapOpenAIError(cause)

    expect(error).toMatchObject({ code, retryable })
    expect(error.cause).toBe(cause)
    expect(error.message).not.toContain("OpenAI")
    expect(error.message).not.toContain("provider diagnostic")
  })

  it("preserves an existing provider-neutral action error", () => {
    const error = new AiActionError("content_rejected")
    expect(mapOpenAIError(error)).toBe(error)
  })
})
