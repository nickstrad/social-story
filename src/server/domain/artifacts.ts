import { pdfUrlFromTask } from "./pdfPlan"
import { storyTitle } from "./storyTitle"
import type { Character, Page, PageImage, Story, Task } from "./types"

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
}: StoryArtifactSources): Artifact[] {
  const base = { storyId: story.id, storyTitle: storyTitle(story) }
  const artifacts: Artifact[] = []

  if (story.baseImageUrl) {
    artifacts.push({
      ...base,
      id: `base-${story.id}`,
      kind: "BASE_IMAGE",
      url: story.baseImageUrl,
      label: "Character reference sheet",
      createdAt: story.updatedAt,
    })
  }

  for (const character of characters) {
    if (!character.photoUrl) continue
    artifacts.push({
      ...base,
      id: `character-${character.id}`,
      kind: "CHARACTER_PHOTO",
      url: character.photoUrl,
      label: `${character.name} photo`,
      createdAt: character.updatedAt,
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
    artifacts.push({
      ...base,
      id: `page-image-${image.id}`,
      kind: "PAGE_IMAGE",
      url: image.url,
      label:
        page?.kind === "COVER" ? "Cover" : `Page ${(page?.position ?? 0) + 1}`,
      createdAt: image.createdAt,
    })
  }

  for (const task of tasks) {
    const url = pdfUrlFromTask(task)
    if (!url) continue
    artifacts.push({
      ...base,
      id: `pdf-${task.id}`,
      kind: "PDF",
      url,
      label: `${base.storyTitle}.pdf`,
      createdAt: task.finishedAt ?? task.createdAt,
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
