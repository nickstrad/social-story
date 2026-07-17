// @vitest-environment node

import { describe, expect, it } from "vitest"

import { characterPhotoAutofillSchema } from "./character-photo-autofill"

describe("characterPhotoAutofillSchema", () => {
  it("accepts exactly the two bounded reviewable suggestions", () => {
    const suggestion = {
      appearance: "Short dark hair",
      photoDescription: "Smiling outdoors in a blue shirt",
    }
    expect(characterPhotoAutofillSchema.parse(suggestion)).toEqual(suggestion)
    expect(
      characterPhotoAutofillSchema.safeParse({ ...suggestion, name: "Sam" })
        .success
    ).toBe(false)
  })

  it("rejects empty and overlong values", () => {
    expect(
      characterPhotoAutofillSchema.safeParse({
        appearance: "",
        photoDescription: "visible",
      }).success
    ).toBe(false)
    expect(
      characterPhotoAutofillSchema.safeParse({
        appearance: "a".repeat(2_001),
        photoDescription: "visible",
      }).success
    ).toBe(false)
  })
})
