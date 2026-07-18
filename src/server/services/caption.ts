import path from "node:path"

import sharp from "sharp"

const BAND_COLOR = "#EAE2F6"
const TEXT_COLOR = "#2B2B2B"
const FONT_FRACTION = 1 / 24
const PADDING_FRACTION = 1 / 20
const LINE_HEIGHT = 1.35
const CAPTION_FONT_PATH = path.join(
  process.cwd(),
  "node_modules/geist/dist/fonts/geist-sans/Geist-Regular.ttf"
)

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

async function renderCaptionBand(width: number, text: string) {
  const fontSize = width * FONT_FRACTION
  const padding = Math.ceil(width * PADDING_FRACTION)
  const { data: caption, info: captionInfo } = await sharp({
    text: {
      text: `<span foreground="${TEXT_COLOR}">${escapeXml(text)}</span>`,
      font: `Geist ${fontSize}`,
      fontfile: CAPTION_FONT_PATH,
      width: width - 2 * padding,
      align: "center",
      rgba: true,
      spacing: Math.ceil(fontSize * (LINE_HEIGHT - 1)),
      wrap: "word-char",
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true })

  return sharp({
    create: {
      width,
      height: captionInfo.height + 2 * padding,
      channels: 4,
      background: BAND_COLOR,
    },
  })
    .composite([{ input: caption, gravity: "center" }])
    .png()
    .toBuffer({ resolveWithObject: true })
}

export async function addCaptionBand(
  png: Buffer,
  text: string
): Promise<Buffer> {
  if (!text.trim()) return png

  const image = sharp(png)
  const metadata = await image.metadata()
  if (!metadata.width || !metadata.height)
    throw new Error("Caption input has no dimensions")

  const { data: band, info: bandInfo } = await renderCaptionBand(
    metadata.width,
    text.trim()
  )

  return image
    .extend({ bottom: bandInfo.height, background: BAND_COLOR })
    .composite([{ input: band, top: metadata.height, left: 0 }])
    .png()
    .toBuffer()
}
