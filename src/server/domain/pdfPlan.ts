import { visiblePagesInOrder } from "./pageOps"
import type { Page, PageImage } from "./types"

export interface PdfPlan {
  /** Selected-image URLs in export order: cover first, then visible pages. */
  orderedImageUrls: string[]
  /** Visible pages that cannot be exported because they lack a chosen image. */
  missing: { pageId: string; reason: string }[]
}

/**
 * Pure export ordering: cover first, then the visible content pages in order,
 * each contributing its selected captioned image. A visible page without a
 * selected image (none picked, or the selection isn't among its variants) is
 * reported in `missing` instead of producing a URL — hidden pages are excluded
 * entirely. No I/O; the task handler fetches the resulting URLs.
 */
export function planPdf(
  pages: Page[],
  imagesByPageId: Record<string, PageImage[]>
): PdfPlan {
  const orderedImageUrls: string[] = []
  const missing: { pageId: string; reason: string }[] = []

  for (const page of visiblePagesInOrder(pages)) {
    const url = page.selectedImageId
      ? imagesByPageId[page.id]?.find(
          (image) => image.id === page.selectedImageId
        )?.url
      : undefined
    if (url) {
      orderedImageUrls.push(url)
    } else {
      missing.push({ pageId: page.id, reason: "no selected image" })
    }
  }

  return { orderedImageUrls, missing }
}
