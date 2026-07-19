// @vitest-environment node

import { describe, expect, it } from "vitest"
import { toJSONSchema } from "zod"
import {
  buildParsedStorySchema,
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

  it("constrains parsed character names to the roster when one exists", () => {
    const schema = buildParsedStorySchema(["Allison", " Mom "])
    const page = { page: 1, text: "Hi", imagePrompt: "A wave" }

    expect(
      schema.safeParse({
        title: "Trip",
        pages: [{ ...page, characterNames: ["Allison", "Mom"] }],
      }).success
    ).toBe(true)
    expect(
      schema.safeParse({
        title: "Trip",
        pages: [{ ...page, characterNames: ["Grandma"] }],
      }).success
    ).toBe(false)

    // Strict structured outputs read the enum off the emitted JSON schema, so
    // an off-roster name is impossible rather than merely unlikely.
    expect(JSON.stringify(toJSONSchema(schema))).toContain(
      '"enum":["Allison","Mom"]'
    )
  })

  it("falls back to unconstrained names when the roster is empty", () => {
    const schema = buildParsedStorySchema([])
    expect(schema).toBe(parsedStorySchema)
    expect(
      schema.safeParse({
        title: "Trip",
        pages: [
          {
            page: 1,
            text: "Hi",
            imagePrompt: "A wave",
            characterNames: ["Anyone"],
          },
        ],
      }).success
    ).toBe(true)
  })

  it("bounds author steering text", () => {
    expect(steeringTextSchema.safeParse("x".repeat(2_001)).success).toBe(false)
  })

  it("requires enough characters for structured rules", () => {
    expect(
      ruleInputSchema.safeParse({
        text: "Stay together",
        kind: "TOGETHER",
        characterIds: ["a"],
      }).success
    ).toBe(false)
    expect(
      ruleInputSchema.safeParse({
        text: "A custom direction",
        kind: "FREEFORM",
        characterIds: [],
      }).success
    ).toBe(true)
  })
})
