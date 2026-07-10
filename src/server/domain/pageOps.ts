import type { ParsedStory } from "./schemas"
import type { Character, Page } from "./types"

function ordered(pages: Page[]): Page[] {
  return [...pages].sort((a, b) => a.position - b.position)
}

function withCoverAndPositions(cover: Page[], content: Page[]): Page[] {
  return [
    ...cover.map((page) => ({ ...page, position: 0 })),
    ...content.map((page, index) => ({ ...page, position: index + 1 })),
  ]
}

export function normalizePositions(pages: Page[]): Page[] {
  const covers = pages.filter(({ kind }) => kind === "COVER")
  if (covers.length > 1) throw new Error("Pages may contain at most one cover")
  const content = ordered(pages.filter(({ kind }) => kind !== "COVER"))
  return withCoverAndPositions(covers, content)
}

export function insertPage(
  pages: Page[],
  afterPosition: number,
  newPage: Page
): Page[] {
  const normalized = normalizePositions(pages)
  const content = normalized.filter(({ kind }) => kind === "PAGE")
  const index = Math.max(0, Math.min(afterPosition, content.length))
  content.splice(index, 0, { ...newPage, kind: "PAGE" })
  return withCoverAndPositions(
    normalized.filter(({ kind }) => kind === "COVER"),
    content
  )
}

export function removePage(pages: Page[], pageId: string): Page[] {
  const target = pages.find(({ id }) => id === pageId)
  if (!target || target.kind === "COVER") return normalizePositions(pages)
  return normalizePositions(pages.filter(({ id }) => id !== pageId))
}

export function movePage(
  pages: Page[],
  pageId: string,
  toPosition: number
): Page[] {
  const normalized = normalizePositions(pages)
  const target = normalized.find(({ id }) => id === pageId)
  if (!target || target.kind === "COVER") return normalized
  const content = normalized.filter(
    ({ id, kind }) => kind === "PAGE" && id !== pageId
  )
  const index = Math.max(0, Math.min(toPosition - 1, content.length))
  content.splice(index, 0, target)
  return withCoverAndPositions(
    normalized.filter(({ kind }) => kind === "COVER"),
    content
  )
}

export function setHidden(
  pages: Page[],
  pageId: string,
  hidden: boolean
): Page[] {
  return pages.map((page) => (page.id === pageId ? { ...page, hidden } : page))
}

/** A page shows in the export/gates a step: the cover always, others unless hidden. */
export function isPageVisible(page: Pick<Page, "kind" | "hidden">): boolean {
  return page.kind === "COVER" || !page.hidden
}

export function visiblePagesInOrder(pages: Page[]): Page[] {
  return normalizePositions(pages).filter(isPageVisible)
}

/**
 * Reorder content pages to follow `orderedPageIds`, then re-normalize with the
 * cover pinned at position 0. Ids that aren't content pages (e.g. the cover) are
 * ignored, so callers can't dislodge the cover.
 */
export function reorderPages(pages: Page[], orderedPageIds: string[]): Page[] {
  const byId = new Map(pages.map((page) => [page.id, page]))
  const content = orderedPageIds
    .map((id) => byId.get(id))
    .filter((page): page is Page => page?.kind === "PAGE")
  return withCoverAndPositions(
    pages.filter(({ kind }) => kind === "COVER"),
    content
  )
}

export function parsedStoryToPages(
  parsed: ParsedStory,
  characters: Character[]
): Page[] {
  const idsByName = new Map(characters.map(({ id, name }) => [name, id]))
  const now = new Date()
  const common = {
    storyId: "",
    steeringText: null,
    hidden: false,
    selectedImageId: null,
    createdAt: now,
    updatedAt: now,
  }
  const cover: Page = {
    ...common,
    id: "cover",
    kind: "COVER",
    position: 0,
    text: parsed.title,
    imagePrompt: parsed.title,
    characterIds: [],
  }
  return [
    cover,
    ...parsed.pages.map((page, index): Page => ({
      ...common,
      id: `page-${index + 1}`,
      kind: "PAGE",
      position: index + 1,
      text: page.text,
      imagePrompt: page.imagePrompt,
      characterIds: page.characterNames.flatMap((name) => {
        const id = idsByName.get(name)
        return id ? [id] : []
      }),
    })),
  ]
}
