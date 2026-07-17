import type { Deps } from "@/server/container"
import type { InputImage } from "@/server/ai"

/**
 * Load a stored blob as a PNG reference image. The upload route re-encodes every
 * photo and generated sheet to PNG before storing, so stored blobs are always
 * PNG — this is the single place that invariant is encoded.
 */
export async function toReferenceImage(
  deps: Deps,
  assetId: string
): Promise<InputImage> {
  const asset = await deps.repos.assets.getById(assetId)
  if (!asset) throw new Error(`Reference asset not found: ${assetId}`)
  return {
    data: await deps.storage.fetchBuffer(asset.storageLocator),
    mediaType: asset.contentType,
  }
}
