import sharp from "sharp"

import type { GeneratedArtwork } from ".."

let tinyPng: Promise<Buffer> | undefined

export async function fakePng(): Promise<Buffer> {
  tinyPng ??= sharp({
    create: {
      width: 4,
      height: 4,
      channels: 4,
      background: { r: 234, g: 226, b: 246, alpha: 1 },
    },
  })
    .png()
    .toBuffer()
  return Buffer.from(await tinyPng)
}

export async function fakeArtwork(
  promptUsed = "deterministic test artwork"
): Promise<GeneratedArtwork> {
  return { png: await fakePng(), promptUsed }
}
