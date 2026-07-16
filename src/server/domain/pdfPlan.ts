import { z } from "zod"

import { visiblePagesInOrder } from "./pageOps"
import type { Page, PageImage, Task } from "./types"

const pdfResultSchema = z.object({ url: z.string().min(1) })

/**
 * The URL a finished PDF_EXPORT task produced, or null for anything else — a
 * task still running, one that failed, or a `resultJson` whose untyped shape
 * doesn't carry a usable url. A malformed payload degrades to "no PDF" rather
 * than throwing, so one bad task can't blank a whole listing.
 */
export function pdfUrlFromTask(task: Task): string | null {
  if (task.type !== "PDF_EXPORT" || task.status !== "SUCCEEDED") return null
  return pdfResultSchema.safeParse(task.resultJson).data?.url ?? null
}

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
