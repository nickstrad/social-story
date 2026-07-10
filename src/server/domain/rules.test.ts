// @vitest-environment node

import { describe, expect, it } from "vitest"
import { applyRulesToPage, applyRulesToStory } from "./rules"
import { character, page, rule } from "./testFactories"

const characters = [character("a"), character("b"), character("c")]

describe("applyRulesToPage", () => {
  it("applies TOGETHER idempotently while preserving stable order", () => {
    const rules = [rule("TOGETHER", ["a", "b"])]
    const once = applyRulesToPage(["c", "b"], rules, characters)
    const twice = applyRulesToPage(once.characterIds, rules, characters)
    expect(once).toEqual({ characterIds: ["c", "b", "a"], changed: true })
    expect(twice).toEqual({ characterIds: ["c", "b", "a"], changed: false })
  })

  it("composes overlapping rules regardless of declaration order", () => {
    const rules = [rule("TOGETHER", ["b", "c"]), rule("TOGETHER", ["a", "b"])]
    expect(applyRulesToPage(["a"], rules, characters).characterIds).toEqual([
      "a",
      "b",
      "c",
    ])
  })

  it("applies NEVER_INCLUDE last so it beats ALWAYS_INCLUDE", () => {
    const rules = [
      rule("ALWAYS_INCLUDE", ["b"]),
      rule("NEVER_INCLUDE", ["b"]),
      rule("FREEFORM", [], "no effect"),
    ]
    expect(applyRulesToPage(["a"], rules, characters).characterIds).toEqual([
      "a",
    ])
  })

  it("leaves scene-only pages untouched by ALWAYS_INCLUDE", () => {
    expect(
      applyRulesToPage([], [rule("ALWAYS_INCLUDE", ["a"])], characters)
    ).toEqual({ characterIds: [], changed: false })
  })
})

describe("applyRulesToStory", () => {
  it("returns new changed pages and a page change count", () => {
    const pages = [{ ...page("one", 1), characterIds: ["a"] }, page("two", 2)]
    const result = applyRulesToStory(
      pages,
      [rule("TOGETHER", ["a", "b"])],
      characters
    )
    expect(result.changed).toBe(1)
    expect(result.pages[0].characterIds).toEqual(["a", "b"])
    expect(result.pages[1]).toBe(pages[1])
  })
})
