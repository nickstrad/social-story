// @vitest-environment node

import { describe, expect, it } from "vitest"
import {
  characterInputSchema,
  createStorySchema,
  parsedStorySchema,
  ruleInputSchema,
  steeringTextSchema,
  updatePageSchema,
} from "./schemas"

describe("domain schemas", () => {
  it("accepts structured stories and reusable router inputs", () => {
    expect(
      parsedStorySchema.parse({
        title: "Trip",
        pages: [
          { page: 1, text: "We go.", imagePrompt: "A car", characterNames: [] },
        ],
      }).title
    ).toBe("Trip")
    expect(
      createStorySchema.parse({
        title: "Trip",
        script: "A sufficiently descriptive social story script.",
      }).script
    ).toContain("story")
    expect(updatePageSchema.parse({ pageId: "p1", hidden: true }).hidden).toBe(
      true
    )
    expect(characterInputSchema.parse({ name: "Allison" }).name).toBe("Allison")
    expect(
      ruleInputSchema.parse({
        text: "Stay together",
        kind: "TOGETHER",
        characterIds: ["a", "b"],
      }).kind
    ).toBe("TOGETHER")
  })

  it("bounds author steering text", () => {
    expect(steeringTextSchema.safeParse("x".repeat(2_001)).success).toBe(false)
  })
})
