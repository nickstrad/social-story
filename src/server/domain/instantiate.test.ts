import { describe, expect, it } from "vitest"

import {
  buildInstantiation,
  remapCharacterIds,
  renameInText,
} from "./instantiate"
import type { Character, Page, Rule, Story } from "./types"

const timestamp = new Date("2026-01-01T00:00:00Z")
const story: Story = {
  id: "template",
  userId: "owner",
  title: "Sam's visit",
  script: "Sam meets Samantha.",
  kind: "TEMPLATE",
  templateId: null,
  status: "PARSED",
  baseImageAssetId: "base",
  coverNote: "A note for Sam.",
  createdAt: timestamp,
  updatedAt: timestamp,
}
const character = (
  id: string,
  name: string,
  isOptional = false
): Character => ({
  id,
  storyId: story.id,
  name,
  role: null,
  age: null,
  appearance: `${name} appearance`,
  photoAssetId: `${id}-photo`,
  photoDescription: `${name} photo`,
  libraryCharacterId: null,
  isOptional,
  createdAt: timestamp,
  updatedAt: timestamp,
})
const page = (characters: string[]): Page => ({
  id: "page",
  storyId: story.id,
  kind: "PAGE",
  position: 1,
  text: "Sam and Pat arrive.",
  imagePrompt: "Show Sam beside Pat.",
  characterIds: characters,
  steeringText: "calm",
  hidden: true,
  selectedImageId: "selected",
  createdAt: timestamp,
  updatedAt: timestamp,
})
const rule = (kind: Rule["kind"], characterIds: string[]): Rule => ({
  id: `${kind}-rule`,
  storyId: story.id,
  text: "Keep Sam and Pat together.",
  kind,
  characterIds,
  createdAt: timestamp,
  updatedAt: timestamp,
})

describe("renameInText", () => {
  it("replaces whole words case-sensitively and longest names first", () => {
    expect(
      renameInText("Sam met Samantha and sam in Samson.", [
        { from: "Sam", to: "Jo" },
        { from: "Samantha", to: "Alex" },
      ])
    ).toBe("Jo met Alex and sam in Samson.")
  })

  it("escapes regex characters in names", () => {
    expect(renameInText("A.B met A0B.", [{ from: "A.B", to: "Lee" }])).toBe(
      "Lee met A0B."
    )
  })

  it("does not rename a replacement a second time", () => {
    expect(
      renameInText("Sam meets Pat.", [
        { from: "Sam", to: "Pat" },
        { from: "Pat", to: "Lee" },
      ])
    ).toBe("Pat meets Lee.")
  })
})

describe("remapCharacterIds", () => {
  it("maps included ids and drops excluded ids", () => {
    expect(
      remapCharacterIds(
        ["a", "missing", "b"],
        new Map([
          ["a", "new-a"],
          ["b", "new-b"],
        ])
      )
    ).toEqual(["new-a", "new-b"])
  })
})

describe("buildInstantiation", () => {
  it("renames and remaps rows while clearing instance-specific assets and details", () => {
    const sam = character("sam", "Sam")
    const pat = character("pat", "Pat", true)
    const result = buildInstantiation(
      {
        story,
        characters: [sam, pat],
        rules: [rule("TOGETHER", [sam.id, pat.id]), rule("FREEFORM", [pat.id])],
        pages: [page([sam.id, pat.id])],
      },
      {
        title: "Sam's new story",
        cast: [
          { templateCharacterId: sam.id, name: "Riley", include: true },
          { templateCharacterId: pat.id, name: "Jordan", include: false },
        ],
      }
    )

    expect(result.story).toMatchObject({
      title: "Riley's new story",
      script: "Riley meets Samantha.",
      kind: "STORY",
      templateId: story.id,
      status: "PARSED",
      coverNote: "A note for Riley.",
    })
    expect(result.characters).toHaveLength(1)
    expect(result.characters[0]).toMatchObject({
      templateCharacterId: sam.id,
      name: "Riley",
      appearance: null,
      photoAssetId: null,
      photoDescription: null,
    })
    expect(result.pages[0]).toMatchObject({
      text: "Riley and Pat arrive.",
      imagePrompt: "Show Riley beside Pat.",
      characterIds: [result.characters[0].id],
      hidden: true,
    })
    expect(result.pages[0]).not.toHaveProperty("selectedImageId")
    expect(result.rules).toEqual([
      {
        text: "Keep Riley and Pat together.",
        kind: "TOGETHER",
        characterIds: [result.characters[0].id],
      },
      {
        text: "Keep Riley and Pat together.",
        kind: "FREEFORM",
        characterIds: [],
      },
    ])
  })
})
