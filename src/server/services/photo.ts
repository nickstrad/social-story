import sharp from "sharp"

const MAX_UPLOAD_DIMENSION = 1024

/** Normalize an uploaded image and strip its original metadata. */
export function normalizeUploadedImage(data: Buffer): Promise<Buffer> {
  return sharp(data)
    .rotate()
    .resize({
      width: MAX_UPLOAD_DIMENSION,
      height: MAX_UPLOAD_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer()
}
