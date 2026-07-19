import { describe, expect, it } from "vitest"

import { character, page, rule } from "@/server/domain/testFactories"
import { applyRulesToPage } from "@/server/domain/rules"
import {
  characterChips,
  effectiveCharacters,
  gridBadge,
  nextFocusable,
} from "./pagesEditor"

describe("nextFocusable", () => {
  const pages = [
    page("cover", 0, "COVER"),
    page("a", 1),
    { ...page("b", 2), hidden: true }, // hidden pages are still navigable
    page("c", 3),
  ]

  it("moves forward and backward through all pages, hidden included", () => {
    expect(nextFocusable(pages, "a", 1)).toBe("b")
    expect(nextFocusable(pages, "b", 1)).toBe("c")
    expect(nextFocusable(pages, "c", -1)).toBe("b")
  })

  it("does not wrap at either end", () => {
    expect(nextFocusable(pages, "cover", -1)).toBeUndefined()
    expect(nextFocusable(pages, "c", 1)).toBeUndefined()
  })

  it("returns undefined for an unknown id", () => {
    expect(nextFocusable(pages, "missing", 1)).toBeUndefined()
  })

  it("respects stored position rather than array order", () => {
    const shuffled = [page("c", 3), page("a", 1), page("b", 2)]
    expect(nextFocusable(shuffled, "a", 1)).toBe("b")
  })
})

describe("effectiveCharacters", () => {
  it("matches the server rule application exactly", () => {
    const characters = [character("ava"), character("bo"), character("cy")]
    const rules = [rule("TOGETHER", ["ava", "bo"])]
    const target = { ...page("p", 1), characterIds: ["ava"] }

    expect(effectiveCharacters(target, rules, characters)).toEqual(
      applyRulesToPage(["ava"], rules, characters).characterIds
    )
    expect(effectiveCharacters(target, rules, characters)).toEqual([
      "ava",
      "bo",
    ])
  })
})

describe("characterChips", () => {
  const characters = [character("ava"), character("bo"), character("cy")]

  it("reports who will be drawn and leaves free choices unlocked", () => {
    const target = { ...page("p", 1), characterIds: ["ava"] }
    expect(characterChips(target, [], characters)).toEqual([
      { id: "ava", name: "ava", effective: true, ruleLocked: false },
      { id: "bo", name: "bo", effective: false, ruleLocked: false },
      { id: "cy", name: "cy", effective: false, ruleLocked: false },
    ])
  })

  it("locks a chip whose presence a rule decides either way", () => {
    // NEVER_INCLUDE keeps cy off the page no matter what the author selects, so
    // offering a toggle would be a control that silently does nothing.
    const rules = [rule("NEVER_INCLUDE", ["cy"])]
    const target = { ...page("p", 1), characterIds: ["ava", "cy"] }
    const chips = characterChips(target, rules, characters)

    expect(chips.find((chip) => chip.id === "cy")).toMatchObject({
      effective: false,
      ruleLocked: true,
    })
    expect(chips.find((chip) => chip.id === "ava")).toMatchObject({
      effective: true,
      ruleLocked: false,
    })
  })

  it("locks a TOGETHER partner the rule keeps on the page", () => {
    // Deselecting bo re-adds it (ava is present), so bo's chip is inert and
    // locks; ava's own chip still decides the pair and stays free.
    const rules = [rule("TOGETHER", ["ava", "bo"])]
    const target = { ...page("p", 1), characterIds: ["ava"] }
    const chips = characterChips(target, rules, characters)

    expect(chips.find((chip) => chip.id === "bo")).toMatchObject({
      effective: true,
      ruleLocked: true,
    })
    expect(chips.find((chip) => chip.id === "ava")).toMatchObject({
      effective: true,
      ruleLocked: false,
    })
  })
})

describe("gridBadge", () => {
  it("labels active generation states", () => {
    expect(gridBadge("queued")).toEqual({
      label: "Queued",
      variant: "secondary",
    })
    expect(gridBadge("generating")).toEqual({
      label: "Generating",
      variant: "secondary",
    })
    expect(gridBadge("failed")).toEqual({
      label: "Failed",
      variant: "destructive",
    })
  })

  it("shows no badge when idle or done", () => {
    expect(gridBadge("idle")).toBeNull()
    expect(gridBadge("done")).toBeNull()
  })
})
