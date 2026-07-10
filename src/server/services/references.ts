import type { Deps } from "@/server/container"
import type { ReferenceImage } from "@/server/ports/image"

/**
 * Load a stored blob as a PNG reference image. The upload route re-encodes every
 * photo and generated sheet to PNG before storing, so stored blobs are always
 * PNG — this is the single place that invariant is encoded.
 */
export async function toReferenceImage(
  deps: Deps,
  url: string
): Promise<ReferenceImage> {
  return { data: await deps.storage.fetchBuffer(url), mimeType: "image/png" }
}
