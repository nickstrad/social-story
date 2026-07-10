// @vitest-environment node
import { describe, expect, it } from "vitest"
import { MAX_PHOTO_BYTES, validateUpload } from "./upload"

describe("validateUpload", () => {
  it("accepts supported images within the limit", () => {
    expect(validateUpload({ mimeType: "image/webp", size: 10 })).toEqual({
      valid: true,
    })
  })
  it("rejects invalid types and oversized images", () => {
    expect(validateUpload({ mimeType: "image/gif", size: 10 }).valid).toBe(
      false
    )
    expect(
      validateUpload({ mimeType: "image/png", size: MAX_PHOTO_BYTES + 1 }).valid
    ).toBe(false)
  })
})
