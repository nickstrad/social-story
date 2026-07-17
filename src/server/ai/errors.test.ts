// @vitest-environment node

import { describe, expect, it } from "vitest"

import { AiActionError } from "./errors"

describe("AI action errors", () => {
  it.each([
    ["invalid_input", false],
    ["content_rejected", false],
    ["invalid_response", true],
    ["rate_limited", true],
    ["unavailable", true],
    ["misconfigured", false],
  ] as const)("provides a safe %s error", (code, retryable) => {
    const cause = new Error("private diagnostic")
    const error = new AiActionError(code, { cause })

    expect(error).toMatchObject({ code, retryable })
    expect(error.cause).toBe(cause)
    expect(error.message).not.toContain("private diagnostic")
  })

  it("supports explicit retryability", () => {
    const error = new AiActionError("content_rejected", { retryable: true })
    expect(error.retryable).toBe(true)
  })
})
