import sharp from "sharp"

const BAND_COLOR = "#EAE2F6"
const TEXT_COLOR = "#2B2B2B"
const FONT_FRACTION = 1 / 24
const PADDING_FRACTION = 1 / 20
const LINE_HEIGHT = 1.35
const CHARACTER_WIDTH_ESTIMATE = 0.55

export function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return [""]

  const lines: string[] = []
  let current = ""
  for (const word of words) {
    if (word.length > maxCharsPerLine) {
      if (current) {
        lines.push(current)
        current = ""
      }
      for (let offset = 0; offset < word.length; offset += maxCharsPerLine) {
        const chunk = word.slice(offset, offset + maxCharsPerLine)
        if (chunk.length === maxCharsPerLine) lines.push(chunk)
        else current = chunk
      }
      continue
    }

    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= maxCharsPerLine) current = candidate
    else {
      lines.push(current)
      current = word
    }
  }
  if (current || lines.length === 0) lines.push(current)
  return lines
}

export function bandHeight(width: number, lineCount: number): number {
  const padding = width * PADDING_FRACTION
  const lineHeight = width * FONT_FRACTION * LINE_HEIGHT
  return Math.ceil(2 * padding + Math.max(1, lineCount) * lineHeight)
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

export function buildCaptionSvg(width: number, lines: string[]): string {
  const fontSize = width * FONT_FRACTION
  const padding = width * PADDING_FRACTION
  const lineHeight = fontSize * LINE_HEIGHT
  const height = bandHeight(width, lines.length)
  const text = lines
    .map(
      (line, index) =>
        `<text x="${width / 2}" y="${padding + fontSize + index * lineHeight}" text-anchor="middle">${escapeXml(line)}</text>`
    )
    .join("")

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${BAND_COLOR}"/><g fill="${TEXT_COLOR}" font-family="Arial, sans-serif" font-size="${fontSize}">${text}</g></svg>`
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

  const fontSize = metadata.width * FONT_FRACTION
  const usableWidth = metadata.width * (1 - 2 * PADDING_FRACTION)
  const maxChars = Math.max(
    1,
    Math.floor(usableWidth / (fontSize * CHARACTER_WIDTH_ESTIMATE))
  )
  const lines = wrapText(text, maxChars)
  const height = bandHeight(metadata.width, lines.length)
  const svg = Buffer.from(buildCaptionSvg(metadata.width, lines))

  return image
    .extend({ bottom: height, background: BAND_COLOR })
    .composite([{ input: svg, top: metadata.height, left: 0 }])
    .png()
    .toBuffer()
}
