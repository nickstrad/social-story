// @vitest-environment node

import sharp from "sharp"
import { describe, expect, it } from "vitest"

import { addCaptionBand } from "./caption"

async function solidPng(width = 480, height = 320) {
  return sharp({
    create: { width, height, channels: 4, background: "#123456" },
  })
    .png()
    .toBuffer()
}

async function captionInkWidth(source: Buffer, text: string) {
  const sourceHeight = (await sharp(source).metadata()).height!
  const { data, info } = await sharp(await addCaptionBand(source, text))
    .raw()
    .toBuffer({ resolveWithObject: true })
  let left = info.width
  let right = -1
  for (let y = sourceHeight; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels
      if (data[offset] < 100) {
        left = Math.min(left, x)
        right = Math.max(right, x)
      }
    }
  }
  return right - left + 1
}

describe("addCaptionBand", () => {
  it("appends a lavender band without changing the artwork", async () => {
    const source = await solidPng(120, 80)
    const output = await addCaptionBand(source, "A calm & reassuring <caption>")
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

  it("renders distinct letter shapes with the packaged font", async () => {
    const source = await solidPng()
    const [narrow, wide] = await Promise.all([
      captionInkWidth(source, "iiiiiiii"),
      captionInkWidth(source, "WWWWWWWW"),
    ])

    expect(wide).toBeGreaterThan(narrow * 2)
  })

  it("returns the original bytes for blank text", async () => {
    const source = await solidPng(4, 4)
    expect(await addCaptionBand(source, "  \n ")).toBe(source)
  })
})
