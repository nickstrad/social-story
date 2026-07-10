import { describe, expect, it } from "vitest"
import { describeRule } from "./ruleText"

describe("describeRule", () => {
  const characters = [
    { id: "a", name: "Allison" },
    { id: "e", name: "Ezra" },
  ]
  it("describes together rules", () => {
    expect(
      describeRule(
        { kind: "TOGETHER", text: "Together", characterIds: ["a", "e"] },
        characters
      )
    ).toBe("Allison and Ezra always appear together")
  })
  it("preserves freeform text", () => {
    expect(
      describeRule(
        { kind: "FREEFORM", text: "Use warm colors", characterIds: [] },
        characters
      )
    ).toBe("Use warm colors")
  })
})
