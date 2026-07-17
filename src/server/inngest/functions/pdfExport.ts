import type { Deps } from "@/server/container"
import { planPdf } from "@/server/domain/pdfPlan"
import type { PageImage, Task } from "@/server/domain/types"
import { registerTaskHandler } from "@/server/inngest/handlers"
import { assemblePdf } from "@/server/services/pdf"
import { createAsset, fetchAssetBuffer } from "@/server/services/assets"
import { storyPdfKey } from "@/server/services/storage-keys"
import {
  runTaskResultStep,
  runTaskStep,
  type TaskStepRunner,
} from "@/server/services/tasks"

function groupByPage(images: PageImage[]): Record<string, PageImage[]> {
  const byPage: Record<string, PageImage[]> = {}
  for (const image of images) {
    ;(byPage[image.pageId] ??= []).push(image)
  }
  return byPage
}

async function preparePdfExport(task: Task, deps: Deps) {
  const [pages, images] = await Promise.all([
    deps.repos.pages.listByStory(task.storyId),
    deps.repos.pages.listImagesByStory(task.storyId),
  ])
  const { orderedImageAssetIds, missing } = planPdf(pages, groupByPage(images))
  if (missing.length > 0) {
    const pagesById = new Map(pages.map((page) => [page.id, page]))
    const labels = missing.map(({ pageId }) => {
      const page = pagesById.get(pageId)
      if (!page) return "an unknown page"
      return page.kind === "COVER" ? "the cover" : `page ${page.position}`
    })
    const verb = missing.length === 1 ? "has" : "have"
    throw new Error(`Cannot export: ${labels.join(", ")} ${verb} no image`)
  }
  return {
    orderedImageAssetIds,
    request: {
      storyPageCount: pages.length,
      availableImageVariantCount: images.length,
    },
    response: {
      ready: true,
      exportPageCount: orderedImageAssetIds.length,
      missingPageCount: 0,
    },
  }
}

async function buildPdfExport(task: Task, deps: Deps, imageAssetIds: string[]) {
  const buffers = await Promise.all(
    imageAssetIds.map((assetId) => fetchAssetBuffer(deps, assetId))
  )
  const pdf = await assemblePdf(buffers)
  const story = await deps.repos.stories.getById(task.storyId)
  if (!story) throw new Error("Story not found")
  const asset = await createAsset(deps, {
    userId: task.userId,
    storyId: task.storyId,
    kind: "PDF",
    key: storyPdfKey(task.storyId),
    data: pdf,
    contentType: "application/pdf",
    filename: `${story.title || "story"}.pdf`,
  })
  await deps.repos.stories.update(task.storyId, { status: "READY" })

  const result = { assetId: asset.id, pageCount: imageAssetIds.length }
  return {
    request: { imageCount: imageAssetIds.length },
    response: { ...result, pdfBytes: pdf.byteLength },
    result,
  }
}

export async function runPdfExportTask(
  task: Task,
  deps: Deps,
  steps?: TaskStepRunner
) {
  const readiness = await runTaskStep(
    steps,
    "Check story pages are ready for PDF export",
    () => preparePdfExport(task, deps)
  )

  return runTaskResultStep(steps, "Build and save downloadable story PDF", () =>
    buildPdfExport(task, deps, readiness.orderedImageAssetIds)
  )
}

registerTaskHandler("PDF_EXPORT", runPdfExportTask)
