import { describe, expect, it } from "vitest"

import { character } from "./testFactories"
import { pickReferencePhoto } from "./photoPick"

const withPhoto = (id: string) => ({
  ...character(id),
  photoAssetId: `asset-${id}`,
  photoUrl: `photo-${id}`,
})

describe("pickReferencePhoto", () => {
  it("returns nothing when an anchor is present, regardless of photos", () => {
    expect(
      pickReferencePhoto({
        pageCharacters: [withPhoto("a"), withPhoto("b")],
        hasAnchor: true,
      })
    ).toBeNull()
  })

  it("attaches the sole photo when exactly one page character has one", () => {
    expect(
      pickReferencePhoto({
        pageCharacters: [withPhoto("a"), character("b")],
        hasAnchor: false,
      })?.id
    ).toBe("a")
  })

  it("attaches nothing when no page character has a photo", () => {
    expect(
      pickReferencePhoto({
        pageCharacters: [character("a"), character("b")],
        hasAnchor: false,
      })
    ).toBeNull()
  })

  it("attaches nothing when two or more page characters have photos", () => {
    expect(
      pickReferencePhoto({
        pageCharacters: [withPhoto("a"), withPhoto("b")],
        hasAnchor: false,
      })
    ).toBeNull()
  })
})
