// @vitest-environment node

import { describe, expect, it } from "vitest"

import { toCharacterContext, toRuleContext } from "./types"

describe("AI context conversion", () => {
  it("strips persistence-only character fields", () => {
    const character = {
      id: "character-1",
      storyId: "story-1",
      name: "Ava",
      role: "reader",
      age: "8",
      appearance: "round glasses",
      photoDescription: "private photo detail",
      photoAssetId: "asset-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    expect(toCharacterContext(character)).toEqual({
      name: "Ava",
      role: "reader",
      age: "8",
      appearance: "round glasses",
    })
  })

  it("strips persistence-only rule fields", () => {
    const rule = {
      id: "rule-1",
      storyId: "story-1",
      kind: "FREEFORM" as const,
      text: "Use green hats",
      characterIds: ["character-1"],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    expect(toRuleContext(rule)).toEqual({
      kind: "FREEFORM",
      text: "Use green hats",
    })
  })
})
