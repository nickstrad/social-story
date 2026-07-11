import type { Deps } from "@/server/container"
import { planPdf } from "@/server/domain/pdfPlan"
import type { PageImage, Task } from "@/server/domain/types"
import { registerTaskHandler } from "@/server/inngest/handlers"
import { assemblePdf } from "@/server/services/pdf"
import { storyPdfKey } from "@/server/services/storage-keys"

function groupByPage(images: PageImage[]): Record<string, PageImage[]> {
  const byPage: Record<string, PageImage[]> = {}
  for (const image of images) {
    ;(byPage[image.pageId] ??= []).push(image)
  }
  return byPage
}

export async function runPdfExportTask(task: Task, deps: Deps) {
  const [pages, images] = await Promise.all([
    deps.repos.pages.listByStory(task.storyId),
    deps.repos.pages.listImagesByStory(task.storyId),
  ])

  const { orderedImageUrls, missing } = planPdf(pages, groupByPage(images))
  if (missing.length > 0) {
    // A readable, page-numbered list so the author knows exactly what to fix.
    // The cover sorts to position 0, content pages to their 1-based order.
    const byId = new Map(pages.map((page) => [page.id, page]))
    const list = missing
      .map(({ pageId }) => {
        const page = byId.get(pageId)
        if (!page) return "an unknown page"
        return page.kind === "COVER" ? "the cover" : `page ${page.position}`
      })
      .join(", ")
    const verb = missing.length === 1 ? "has" : "have"
    throw new Error(`Cannot export: ${list} ${verb} no image`)
  }

  const buffers = await Promise.all(
    orderedImageUrls.map((url) => deps.storage.fetchBuffer(url))
  )
  const pdf = await assemblePdf(buffers)
  const { url } = await deps.storage.put(
    storyPdfKey(task.storyId),
    pdf,
    "application/pdf"
  )

  await deps.repos.stories.update(task.storyId, { status: "READY" })

  return { url, pageCount: orderedImageUrls.length }
}

registerTaskHandler("PDF_EXPORT", runPdfExportTask)
