// @vitest-environment node

import { PDFDocument } from "pdf-lib"
import sharp from "sharp"
import { describe, expect, it } from "vitest"

import { assemblePdf } from "./pdf"

function coloredPng(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number
): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 4, background: { r, g, b, alpha: 1 } },
  })
    .png()
    .toBuffer()
}

describe("assemblePdf", () => {
  it("builds a %PDF with one page per image sized to each image", async () => {
    const [a, b] = await Promise.all([
      coloredPng(30, 20, 200, 100, 50),
      coloredPng(40, 60, 10, 20, 30),
    ])

    const pdf = await assemblePdf([a, b])
    expect(pdf.subarray(0, 4).toString("latin1")).toBe("%PDF")

    const doc = await PDFDocument.load(pdf)
    expect(doc.getPageCount()).toBe(2)
    const [first, second] = doc.getPages()
    expect(first.getWidth()).toBe(30)
    expect(first.getHeight()).toBe(20)
    expect(second.getWidth()).toBe(40)
    expect(second.getHeight()).toBe(60)
  })
})
