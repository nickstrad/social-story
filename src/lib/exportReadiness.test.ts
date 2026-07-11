import { describe, expect, it } from "vitest"

import { exportReadiness } from "./exportReadiness"
import { page } from "@/server/domain/testFactories"
import type { Page } from "@/server/domain/types"

function withImage(p: Page, url: string | null) {
  return { ...p, selectedImageId: url ? "img" : null, selectedImageUrl: url }
}

describe("exportReadiness", () => {
  it("orders cover first and labels content pages 1-based", () => {
    const cover = withImage(page("cover", 0, "COVER"), "url-cover")
    const p1 = withImage(page("p1", 1), "url-1")
    const p2 = withImage(page("p2", 2), "url-2")

    const { ready, missing, canExport } = exportReadiness([p2, cover, p1])

    expect(ready).toEqual([
      { pageId: "cover", label: "Cover" },
      { pageId: "p1", label: "Page 1" },
      { pageId: "p2", label: "Page 2" },
    ])
    expect(missing).toEqual([])
    expect(canExport).toBe(true)
  })

  it("excludes hidden pages and reports missing images, blocking export", () => {
    const cover = withImage(page("cover", 0, "COVER"), "url-cover")
    const hidden = { ...withImage(page("p1", 1), null), hidden: true }
    const p2 = withImage(page("p2", 2), null)

    const { ready, missing, canExport } = exportReadiness([cover, hidden, p2])

    expect(ready).toEqual([{ pageId: "cover", label: "Cover" }])
    // Hidden p1 is omitted entirely; visible p2 (2nd content page) is missing.
    expect(missing).toEqual([{ pageId: "p2", label: "Page 2" }])
    expect(canExport).toBe(false)
  })
})
