// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest"

import { computeBackoff, OpenAIHttpError, requestWithRetry } from "./http"

describe("computeBackoff", () => {
  it("doubles from one second", () => {
    expect([0, 1, 2].map((attempt) => computeBackoff(attempt))).toEqual([
      1_000, 2_000, 4_000,
    ])
  })

  it("prefers Retry-After seconds and caps excessive delays", () => {
    expect(computeBackoff(2, "7")).toBe(7_000)
    expect(computeBackoff(0, "300")).toBe(30_000)
  })
})

describe("requestWithRetry", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("retries a 429 and then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("slow down", {
          status: 429,
          headers: { "Retry-After": "0" },
        })
      )
      .mockResolvedValueOnce(new Response("ok"))
    vi.stubGlobal("fetch", fetchMock)

    const response = await requestWithRetry(["https://example.test"])

    expect(await response.text()).toBe("ok")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("fails fast with private diagnostic detail on a client error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("private body", { status: 400 }))
    )

    const error = await requestWithRetry(["https://example.test"]).catch(
      (caught: unknown) => caught
    )
    expect(error).toBeInstanceOf(OpenAIHttpError)
    expect(error).toMatchObject({ status: 400, responseBody: "private body" })
  })
})
