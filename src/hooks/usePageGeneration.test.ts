import { describe, expect, it } from "vitest"

import type { PageImage } from "@/server/domain/types"
import { task } from "@/server/domain/testFactories"
import { derivePageGenState } from "./usePageGeneration"

function image(variant: number, url = `url-v${variant}`): PageImage {
  const now = new Date("2026-01-01T00:00:00Z")
  return {
    id: `img-${variant}`,
    pageId: "page",
    url,
    rawUrl: null,
    promptUsed: "p",
    variant,
    createdAt: now,
    updatedAt: now,
  }
}

describe("derivePageGenState", () => {
  it("is idle with no tasks and no images", () => {
    expect(derivePageGenState([], [])).toEqual({
      state: "idle",
      latestImageUrl: undefined,
    })
  })

  it("maps PENDING to queued and RUNNING to generating", () => {
    expect(derivePageGenState([task("PENDING")], []).state).toBe("queued")
    expect(derivePageGenState([task("RUNNING")], []).state).toBe("generating")
  })

  it("maps FAILED to failed", () => {
    expect(derivePageGenState([task("FAILED")], []).state).toBe("failed")
  })

  it("is done when a variant exists and no task is active", () => {
    const result = derivePageGenState([task("SUCCEEDED")], [image(1)])
    expect(result.state).toBe("done")
  })

  it("is done from prior-session images even with no task", () => {
    expect(derivePageGenState([], [image(1)]).state).toBe("done")
  })

  it("tracks the newest task by createdAt", () => {
    const older = task("SUCCEEDED", {
      id: "old",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    })
    const newer = task("RUNNING", {
      id: "new",
      createdAt: new Date("2026-01-02T00:00:00Z"),
    })
    expect(derivePageGenState([older, newer], [image(1)]).state).toBe(
      "generating"
    )
  })

  it("exposes the highest-variant image url", () => {
    expect(
      derivePageGenState([], [image(1), image(3), image(2)]).latestImageUrl
    ).toBe("url-v3")
  })
})
