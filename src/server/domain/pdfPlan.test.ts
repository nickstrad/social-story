import { describe, expect, it } from "vitest"

import { planPdf } from "./pdfPlan"
import { page } from "./testFactories"
import type { Page, PageImage } from "./types"

function withSelection(p: Page, imageId: string | null): Page {
  return { ...p, selectedImageId: imageId }
}

function image(id: string, pageId: string, assetId: string): PageImage {
  return {
    id,
    pageId,
    imageAssetId: assetId,
    rawAssetId: null,
    source: "AI",
    promptUsed: "",
    variant: 1,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  }
}

describe("planPdf", () => {
  it("orders the cover first, then visible content pages by position", () => {
    const cover = withSelection(page("cover", 0, "COVER"), "img-cover")
    const p2 = withSelection(page("p2", 2), "img-2")
    const p1 = withSelection(page("p1", 1), "img-1")

    const { orderedImageAssetIds, missing } = planPdf([p2, cover, p1], {
      cover: [image("img-cover", "cover", "url-cover")],
      p1: [image("img-1", "p1", "url-1")],
      p2: [image("img-2", "p2", "url-2")],
    })

    expect(orderedImageAssetIds).toEqual(["url-cover", "url-1", "url-2"])
    expect(missing).toEqual([])
  })

  it("excludes hidden pages from the export", () => {
    const cover = withSelection(page("cover", 0, "COVER"), "img-cover")
    const hidden = { ...withSelection(page("p1", 1), "img-1"), hidden: true }

    const { orderedImageAssetIds, missing } = planPdf([cover, hidden], {
      cover: [image("img-cover", "cover", "url-cover")],
      p1: [image("img-1", "p1", "url-1")],
    })

    expect(orderedImageAssetIds).toEqual(["url-cover"])
    expect(missing).toEqual([])
  })

  it("reports visible pages with no selected image as missing", () => {
    const cover = withSelection(page("cover", 0, "COVER"), "img-cover")
    const noSelection = withSelection(page("p1", 1), null)
    // Selected id no longer among the page's variants → also missing.
    const staleSelection = withSelection(page("p2", 2), "gone")

    const { orderedImageAssetIds, missing } = planPdf(
      [cover, noSelection, staleSelection],
      {
        cover: [image("img-cover", "cover", "url-cover")],
        p2: [image("img-2", "p2", "url-2")],
      }
    )

    expect(orderedImageAssetIds).toEqual(["url-cover"])
    expect(missing).toEqual([
      { pageId: "p1", reason: "no selected image" },
      { pageId: "p2", reason: "no selected image" },
    ])
  })
})
