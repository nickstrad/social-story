export const PHOTO_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024

export type UploadValidation = { valid: true } | { valid: false; error: string }

export function validateUpload(input: {
  mimeType: string
  size: number
}): UploadValidation {
  if (
    !PHOTO_MIME_TYPES.includes(
      input.mimeType as (typeof PHOTO_MIME_TYPES)[number]
    )
  ) {
    return { valid: false, error: "Photo must be a PNG, JPEG, or WebP image" }
  }
  if (input.size <= 0) return { valid: false, error: "Photo is empty" }
  if (input.size > MAX_PHOTO_BYTES) {
    return { valid: false, error: "Photo must be 8 MB or smaller" }
  }
  return { valid: true }
}
