import { describe, expect, it } from "vitest"

import { isAllSelected, selectAll, selectNone, toggle } from "./selection"

describe("selection helpers", () => {
  it("toggle adds an absent id and removes a present one", () => {
    const once = toggle(new Set(), "a")
    expect([...once]).toEqual(["a"])
    expect([...toggle(once, "a")]).toEqual([])
  })

  it("toggle does not mutate the input set", () => {
    const original = new Set(["a"])
    toggle(original, "b")
    expect([...original]).toEqual(["a"])
  })

  it("selectAll selects every id and selectNone clears", () => {
    expect([...selectAll(["a", "b"])]).toEqual(["a", "b"])
    expect([...selectNone()]).toEqual([])
  })

  it("isAllSelected is true only when every id is present", () => {
    expect(isAllSelected(new Set(["a", "b"]), ["a", "b"])).toBe(true)
    expect(isAllSelected(new Set(["a"]), ["a", "b"])).toBe(false)
    expect(isAllSelected(new Set(), [])).toBe(false)
  })
})
