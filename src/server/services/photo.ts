import sharp from "sharp"

const MAX_REFERENCE_DIMENSION = 1024

/** Normalize an uploaded reference photo and strip its original metadata. */
export function normalizeReferencePhoto(data: Buffer): Promise<Buffer> {
  return sharp(data)
    .rotate()
    .resize({
      width: MAX_REFERENCE_DIMENSION,
      height: MAX_REFERENCE_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer()
}
