// @vitest-environment node

import { describe, expect, it } from "vitest"
import { character, rule } from "./testFactories"
import {
  buildBaseSheetPrompt,
  buildCastDescription,
  buildCoverPrompt,
  buildImagePrompt,
  buildParseSystemPrompt,
  buildStyleContext,
} from "./prompts"

const allison = {
  ...character("a", "Allison"),
  role: "daughter",
  age: "7",
  appearance: "two puff buns",
}
const ezra = character("e", "Ezra")

describe("prompt builders", () => {
  it("uses default and custom reader context", () => {
    expect(buildStyleContext()).toContain(
      "calm, clear children's social-story style"
    )
    expect(
      buildStyleContext({ readerDescription: "a ten-year-old reader" })
    ).toContain("ten-year-old reader")
  })

  it("returns no cast for an empty roster and describes character data", () => {
    expect(buildCastDescription([])).toBe("")
    expect(buildCastDescription([allison])).toContain(
      "Allison: daughter, 7, two puff buns"
    )
  })

  it("keeps scene-only prompts people-free without a cast", () => {
    const prompt = buildImagePrompt({
      scene: "An airport",
      characters: [],
      allCharacters: [allison],
      anchored: true,
    })
    expect(prompt).toContain("NO people")
    expect(prompt).not.toContain("Allison:")
    expect(prompt).not.toContain("reference sheet is attached")
  })

  it("lists exactly the selected people and includes optional direction", () => {
    const prompt = buildImagePrompt({
      scene: "Playing",
      characters: [ezra],
      allCharacters: [allison, ezra],
      anchored: true,
      steeringText: "Blue shirts",
    })
    expect(prompt).toContain(
      "Exactly these characters appear together in this scene: Ezra"
    )
    expect(prompt).toContain("reference sheet is attached")
    expect(prompt).toContain(
      "Additional direction from the author: Blue shirts"
    )
  })

  it("includes only FREEFORM rules verbatim in image prompts", () => {
    const prompt = buildImagePrompt({
      scene: "Playing outside",
      characters: [allison],
      allCharacters: [allison],
      anchored: false,
      rules: [
        rule("FREEFORM", [], "All hats are green"),
        rule("ALWAYS_INCLUDE", ["a"], "Allison always appears"),
      ],
    })
    expect(prompt).toContain("All hats are green")
    expect(prompt).not.toContain("Allison always appears")
  })

  it("builds reference sheets and text-free covers", () => {
    expect(buildBaseSheetPrompt([allison])).toContain("full body")
    const cover = buildCoverPrompt({
      title: "My Trip",
      characters: [allison],
      note: "include an airplane",
    })
    expect(cover).toContain("Do NOT draw any text")
    expect(cover).toContain("include an airplane")
    expect(buildCoverPrompt({ title: "Places", characters: [] })).toContain(
      "without adding people"
    )
  })

  it("generalizes the parse roster and includes freeform rules verbatim", () => {
    const prompt = buildParseSystemPrompt(
      [allison],
      [rule("FREEFORM", [], "All hats are green")]
    )
    expect(prompt).toContain("Allison: daughter, 7, two puff buns")
    expect(prompt).toContain("All hats are green")
    expect(buildParseSystemPrompt([], [])).toContain("No recurring characters")
  })
})
