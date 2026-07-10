// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest"

import { computeBackoff, requestWithRetry } from "./http"

describe("computeBackoff", () => {
  it("doubles from one second", () => {
    expect([0, 1, 2].map((attempt) => computeBackoff(attempt))).toEqual([
      1_000, 2_000, 4_000,
    ])
  })

  it("prefers Retry-After seconds", () => {
    expect(computeBackoff(2, "7")).toBe(7_000)
  })

  it("caps excessive server-directed delays", () => {
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

  it("fails fast on a non-retryable client error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("bad", { status: 400 }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(requestWithRetry(["https://example.test"])).rejects.toThrow(
      "OpenAI request failed (400): bad"
    )
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
