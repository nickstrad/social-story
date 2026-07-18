import { TRPCError } from "@trpc/server"

import {
  assertPageOwnership,
  assertStoryOwnership,
} from "@/server/api/ownership"
import type { Deps } from "@/server/container"
import { nextVariant, hasActiveTask } from "@/server/domain/taskMachine"
import { validateUpload } from "@/server/domain/upload"
import {
  createPageImageAssets,
  clientPageImage,
} from "@/server/services/assets"
import { addCaptionBand } from "@/server/services/caption"
import { normalizeUploadedImage } from "@/server/services/photo"
import { pageImageKey, pageImageRawKey } from "@/server/services/storage-keys"
import { listStoryTasks } from "@/server/services/tasks"

export class PageImageUploadError extends Error {
  constructor(
    readonly code: "INVALID_UPLOAD" | "ACTIVE_GENERATION",
    message: string
  ) {
    super(message)
    this.name = "PageImageUploadError"
  }
}

export async function uploadPageImage(
  deps: Deps,
  input: {
    userId: string
    storyId: string
    pageId: string
    file: File
  }
) {
  const validation = validateUpload({
    mimeType: input.file.type,
    size: input.file.size,
  })
  if (!validation.valid) {
    throw new PageImageUploadError("INVALID_UPLOAD", validation.error)
  }

  const [story, page] = await Promise.all([
    assertStoryOwnership(deps.repos, input.storyId, input.userId),
    assertPageOwnership(deps.repos, input.pageId, input.userId),
  ])
  if (page.storyId !== story.id) {
    throw new TRPCError({ code: "NOT_FOUND" })
  }

  const tasks = await listStoryTasks(deps, story.id)
  if (hasActiveTask(tasks, { type: "PAGE_IMAGE", pageId: page.id })) {
    throw new PageImageUploadError(
      "ACTIVE_GENERATION",
      "This page is already generating an image"
    )
  }

  let raw: Buffer
  try {
    raw = await normalizeUploadedImage(
      Buffer.from(await input.file.arrayBuffer())
    )
  } catch {
    throw new PageImageUploadError("INVALID_UPLOAD", "Photo could not be read")
  }

  const [existing, captioned] = await Promise.all([
    deps.repos.pages.listImages(page.id),
    addCaptionBand(raw, page.kind === "COVER" ? story.title : page.text),
  ])
  const variant = nextVariant(existing.map((image) => image.variant))
  const image = await createPageImageAssets(deps, {
    userId: input.userId,
    storyId: story.id,
    pageId: page.id,
    source: "UPLOAD",
    promptUsed: null,
    variant,
    filename: input.file.name,
    raw,
    captioned,
    rawKey: pageImageRawKey(story.id, page.id, variant),
    captionedKey: pageImageKey(story.id, page.id, variant),
  })

  return clientPageImage(image)
}
