import { pdfAssetIdFromTask } from "./pdfPlan"
import { storyTitle } from "./storyTitle"
import type { Asset, Character, Page, PageImage, Story, Task } from "./types"
import { assetUrl } from "../services/assets"

export type ArtifactKind =
  "BASE_IMAGE" | "CHARACTER_PHOTO" | "PAGE_IMAGE" | "PDF"

export interface Artifact {
  id: string
  kind: ArtifactKind
  url: string
  label: string
  storyId: string
  storyTitle: string
  createdAt: Date
}

export interface StoryArtifactSources {
  story: Story
  characters: Character[]
  pages: Page[]
  pageImages: PageImage[]
  tasks: Task[]
  assets: Asset[]
}

/**
 * Flatten one story's stored blobs into a uniform artifact list. Every source
 * is optional in practice — a DRAFT story has none of them — so each block
 * contributes independently rather than short-circuiting the whole story.
 */
function collectStoryArtifacts({
  story,
  characters,
  pages,
  pageImages,
  tasks,
  assets,
}: StoryArtifactSources): Artifact[] {
  const base = { storyId: story.id, storyTitle: storyTitle(story) }
  const artifacts: Artifact[] = []

  const assetsById = new Map(assets.map((asset) => [asset.id, asset]))
  const baseAsset = story.baseImageAssetId
    ? assetsById.get(story.baseImageAssetId)
    : null
  if (baseAsset?.kind === "BASE_IMAGE") {
    artifacts.push({
      ...base,
      id: baseAsset.id,
      kind: "BASE_IMAGE",
      url: assetUrl(baseAsset.id),
      label: "Character reference sheet",
      createdAt: baseAsset.createdAt,
    })
  }

  for (const character of characters) {
    const asset = character.photoAssetId
      ? assetsById.get(character.photoAssetId)
      : null
    if (asset?.kind !== "CHARACTER_PHOTO") continue
    artifacts.push({
      ...base,
      id: asset.id,
      kind: "CHARACTER_PHOTO",
      url: assetUrl(asset.id),
      label: `${character.name} photo`,
      createdAt: asset.createdAt,
    })
  }

  // Only selected variants are shown: the rejected ones are noise here, and the
  // page editor is where variants get compared.
  const selectedIds = new Set(
    pages.map((page) => page.selectedImageId).filter(Boolean)
  )
  const pageById = new Map(pages.map((page) => [page.id, page]))
  for (const image of pageImages) {
    if (!selectedIds.has(image.id)) continue
    const page = pageById.get(image.pageId)
    const asset = assetsById.get(image.imageAssetId)
    if (asset?.kind !== "PAGE_IMAGE") continue
    artifacts.push({
      ...base,
      id: asset.id,
      kind: "PAGE_IMAGE",
      url: assetUrl(asset.id),
      label:
        page?.kind === "COVER" ? "Cover" : `Page ${(page?.position ?? 0) + 1}`,
      createdAt: asset.createdAt,
    })
  }

  for (const task of tasks) {
    const assetId = pdfAssetIdFromTask(task)
    const asset = assetId ? assetsById.get(assetId) : null
    if (asset?.kind !== "PDF") continue
    artifacts.push({
      ...base,
      id: asset.id,
      kind: "PDF",
      url: assetUrl(asset.id),
      label: `${base.storyTitle}.pdf`,
      createdAt: asset.createdAt,
    })
  }

  return artifacts
}

/** Merge many stories' artifacts into one newest-first feed. */
export function collectArtifacts(sources: StoryArtifactSources[]): Artifact[] {
  return sources
    .flatMap(collectStoryArtifacts)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}
