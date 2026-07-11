import { visiblePagesInOrder } from "@/server/domain/pageOps"
import type { Page } from "@/server/domain/types"

/** A page as returned by `story.get`: the domain page plus its chosen image. */
type PageWithImage = Page & { selectedImageUrl: string | null }

export interface ExportPageRef {
  pageId: string
  /** "Cover" or the page's 1-based content position, for user-facing labels. */
  label: string
}

export interface ExportReadiness {
  ready: ExportPageRef[]
  missing: ExportPageRef[]
  /** True when there is at least one exportable page and nothing is missing. */
  canExport: boolean
}

function label(page: Page): string {
  // `visiblePagesInOrder` normalizes positions: content pages are numbered
  // 1-based over ALL content pages (hidden included), so `position` already
  // matches the editor's "Page N" numbering — no separate index needed.
  return page.kind === "COVER" ? "Cover" : `Page ${page.position}`
}

/**
 * Client mirror of `planPdf`: from the story's pages (cover first, hidden
 * excluded), split visible pages into those with a selected image and those
 * still missing one. Pure so the export hook and its tests share the logic.
 */
export function exportReadiness(pages: PageWithImage[]): ExportReadiness {
  const urlById = new Map(pages.map((page) => [page.id, page.selectedImageUrl]))
  const ready: ExportPageRef[] = []
  const missing: ExportPageRef[] = []

  for (const page of visiblePagesInOrder(pages)) {
    const ref = { pageId: page.id, label: label(page) }
    if (urlById.get(page.id)) {
      ready.push(ref)
    } else {
      missing.push(ref)
    }
  }

  return { ready, missing, canExport: ready.length > 0 && missing.length === 0 }
}
