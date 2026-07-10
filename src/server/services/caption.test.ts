// @vitest-environment node

import sharp from "sharp"
import { describe, expect, it } from "vitest"

import {
  addCaptionBand,
  bandHeight,
  buildCaptionSvg,
  wrapText,
} from "./caption"

describe("caption helpers", () => {
  it("wraps exact fits, whitespace, and long words", () => {
    expect(wrapText("one two", 7)).toEqual(["one two"])
    expect(wrapText("", 5)).toEqual([""])
    expect(wrapText("abcdefgh", 3)).toEqual(["abc", "def", "gh"])
  })

  it("scales the band with width and line count", () => {
    expect(bandHeight(1_000, 2)).toBeGreaterThan(bandHeight(1_000, 1))
    expect(bandHeight(1_000, 1)).toBeGreaterThan(bandHeight(500, 1))
  })

  it("escapes caption text in SVG", () => {
    expect(buildCaptionSvg(240, ["A & <B>"])).toContain("A &amp; &lt;B&gt;")
  })
})

describe("addCaptionBand", () => {
  it("appends a lavender band without changing the artwork", async () => {
    const source = await sharp({
      create: { width: 120, height: 80, channels: 4, background: "#123456" },
    })
      .png()
      .toBuffer()
    const output = await addCaptionBand(source, "A calm caption")
    const sourcePixels = await sharp(source).raw().toBuffer()
    const { data: outputPixels, info } = await sharp(output)
      .raw()
      .toBuffer({ resolveWithObject: true })

    expect(info.width).toBe(120)
    expect(info.height).toBeGreaterThan(80)
    expect(outputPixels.subarray(0, sourcePixels.length)).toEqual(sourcePixels)
    const lastPixel = outputPixels.subarray(outputPixels.length - 4)
    expect([...lastPixel]).toEqual([234, 226, 246, 255])
  })

  it("returns the original bytes for blank text", async () => {
    const source = await sharp({
      create: { width: 4, height: 4, channels: 4, background: "red" },
    })
      .png()
      .toBuffer()
    expect(await addCaptionBand(source, "  \n ")).toBe(source)
  })
})
