// @vitest-environment node

import { describe, expect, it } from "vitest"
import {
  insertPage,
  isPageVisible,
  movePage,
  normalizePositions,
  parsedStoryToPages,
  removePage,
  reorderPages,
  setHidden,
  visiblePagesInOrder,
} from "./pageOps"
import { character, page } from "./testFactories"

const cover = page("cover", 8, "COVER")

describe("page collection operations", () => {
  it("normalizes content and pins the cover at zero", () => {
    const result = normalizePositions([page("b", 9), cover, page("a", 3)])
    expect(result.map(({ id, position }) => [id, position])).toEqual([
      ["cover", 0],
      ["a", 1],
      ["b", 2],
    ])
    expect(() =>
      normalizePositions([cover, page("other-cover", 0, "COVER")])
    ).toThrow("at most one cover")
  })

  it("inserts after the cover at zero, clamps negatives, and appends past the end", () => {
    const pages = [cover, page("a", 1), page("b", 2)]
    expect(insertPage(pages, 0, page("zero", 99)).map(({ id }) => id)).toEqual([
      "cover",
      "zero",
      "a",
      "b",
    ])
    expect(
      insertPage(pages, -10, page("negative", 99)).map(({ id }) => id)
    ).toEqual(["cover", "negative", "a", "b"])
    expect(insertPage(pages, 99, page("last", 99)).map(({ id }) => id)).toEqual(
      ["cover", "a", "b", "last"]
    )
  })

  it("inserts, removes, and moves with contiguous positions", () => {
    const inserted = insertPage(
      [cover, page("a", 1), page("c", 2)],
      1,
      page("b", 99)
    )
    expect(inserted.map(({ id }) => id)).toEqual(["cover", "a", "b", "c"])
    const moved = movePage(inserted, "c", 1)
    expect(moved.map(({ id, position }) => [id, position])).toEqual([
      ["cover", 0],
      ["c", 1],
      ["a", 2],
      ["b", 3],
    ])
    expect(removePage(moved, "a").map(({ id }) => id)).toEqual([
      "cover",
      "c",
      "b",
    ])
    expect(removePage(moved, "cover").map(({ id }) => id)).toContain("cover")
  })

  it("updates hidden state immutably and orders only visible pages", () => {
    const pages = [page("b", 2), cover, page("a", 1)]
    const hidden = setHidden(pages, "a", true)
    expect(pages[2].hidden).toBe(false)
    expect(visiblePagesInOrder(hidden).map(({ id }) => id)).toEqual([
      "cover",
      "b",
    ])
  })

  it("resolves names case- and whitespace-insensitively and creates a cover", () => {
    const { pages, unmatchedCharacterNames } = parsedStoryToPages(
      {
        title: "My Story",
        pages: [
          {
            page: 1,
            text: "Hello",
            imagePrompt: "A wave",
            characterNames: ["  allison ", "MOM"],
          },
        ],
      },
      [character("a", "Allison"), character("m", "Mom")]
    )
    expect(pages[0]).toMatchObject({
      kind: "COVER",
      position: 0,
      text: "My Story",
    })
    expect(pages[1].characterIds).toEqual(["a", "m"])
    expect(unmatchedCharacterNames).toEqual([])
  })

  it("reports names it could not resolve instead of dropping them silently", () => {
    const { pages, unmatchedCharacterNames } = parsedStoryToPages(
      {
        title: "My Story",
        pages: [
          {
            page: 1,
            text: "Hello",
            imagePrompt: "A wave",
            characterNames: ["Allison", "Unknown", "Unknown"],
          },
        ],
      },
      [character("a", "Allison")]
    )
    expect(pages[1].characterIds).toEqual(["a"])
    expect(unmatchedCharacterNames).toEqual(["Unknown"])
  })

  it("reorders content by the requested permutation and pins the cover", () => {
    const pages = [cover, page("a", 1), page("b", 2), page("c", 3)]
    const result = reorderPages(pages, ["c", "a", "b"])
    expect(result.map(({ id }) => id)).toEqual(["cover", "c", "a", "b"])
    expect(result.map(({ position }) => position)).toEqual([0, 1, 2, 3])
  })

  it("ignores any attempt to reorder the cover out of position 0", () => {
    const pages = [cover, page("a", 1), page("b", 2)]
    const result = reorderPages(pages, ["b", "cover", "a"])
    expect(result.map(({ id }) => id)).toEqual(["cover", "b", "a"])
    expect(result[0].position).toBe(0)
  })

  it("treats the cover as always visible and other pages by hidden flag", () => {
    expect(isPageVisible(cover)).toBe(true)
    expect(isPageVisible({ ...cover, hidden: true })).toBe(true)
    expect(isPageVisible(page("a", 1))).toBe(true)
    expect(isPageVisible({ ...page("a", 1), hidden: true })).toBe(false)
  })

  it("creates unique ids when parsed page numbers repeat", () => {
    const { pages } = parsedStoryToPages(
      {
        title: "My Story",
        pages: [
          { page: 1, text: "One", imagePrompt: "One", characterNames: [] },
          { page: 1, text: "Again", imagePrompt: "Again", characterNames: [] },
        ],
      },
      []
    )
    expect(pages.map(({ id }) => id)).toEqual(["cover", "page-1", "page-2"])
  })
})
