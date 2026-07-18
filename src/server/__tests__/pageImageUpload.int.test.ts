// @vitest-environment node

import sharp from "sharp"
import { beforeEach, describe, expect, it } from "vitest"

import { createFakeAiActions, fakeArtwork } from "@/server/ai/testing/fakes"
import { createTestCaller } from "@/server/api/test-utils"
import type { Deps } from "@/server/container"
import { MAX_PHOTO_BYTES } from "@/server/domain/upload"
import { runPageImageTask } from "@/server/inngest/functions/pageImage"
import { inMemoryRepos } from "@/server/repos/memory"
import { immediateDispatcher } from "@/server/services/fakes"
import { inMemoryStorage } from "@/server/services/memory-storage"
import { uploadPageImage } from "@/server/services/page-image-upload"
import { runTask } from "@/server/services/tasks"

const userId = "upload-user"
const user = {
  id: userId,
  name: "Upload Test",
  email: "upload@example.com",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
}

async function png(width = 24, height = 12) {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 40, g: 90, b: 160, alpha: 1 },
    },
  })
    .png()
    .toBuffer()
}

function file(bytes: Buffer, type = "image/png", name = "drawing.png") {
  const data = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer
  return new File([data], name, { type })
}

describe("page image upload integration", () => {
  let deps: Deps
  let storyId: string
  let pageId: string

  beforeEach(async () => {
    const repos = inMemoryRepos()
    deps = {
      repos,
      storage: inMemoryStorage(),
      ai: createFakeAiActions({
        pageImage: async () => fakeArtwork("generated after upload"),
      }),
      dispatcher: immediateDispatcher((taskId) =>
        runTask(deps, taskId, runPageImageTask)
      ),
    }
    const story = await repos.stories.create({
      userId,
      title: "Upload Story",
      script: "Script",
    })
    storyId = story.id
    const page = await repos.pages.create({
      storyId,
      kind: "PAGE",
      position: 1,
      text: "The page caption.",
      imagePrompt: "A calm scene",
      characterIds: [],
    })
    pageId = page.id
  })

  it("creates selected raw and captioned upload assets without replacing prior variants", async () => {
    const existing = await deps.repos.pages.addImage({
      pageId,
      imageAssetId: "existing-asset",
      promptUsed: "prior AI prompt",
      variant: 1,
    })
    await deps.repos.pages.update(pageId, { selectedImageId: existing.id })

    const uploaded = await uploadPageImage(deps, {
      userId,
      storyId,
      pageId,
      file: file(await png(2048, 1024)),
    })

    expect(uploaded).toMatchObject({
      source: "UPLOAD",
      promptUsed: null,
      variant: 2,
      url: expect.stringMatching(/^\/api\/me\/assets\//),
    })
    const images = await deps.repos.pages.listImages(pageId)
    expect(images).toHaveLength(2)
    expect(images[0].id).toBe(existing.id)
    expect((await deps.repos.pages.getById(pageId))?.selectedImageId).toBe(
      uploaded.id
    )

    const rawAsset = await deps.repos.assets.getById(uploaded.rawAssetId!)
    const captionedAsset = await deps.repos.assets.getById(
      uploaded.imageAssetId
    )
    expect(rawAsset).toMatchObject({
      kind: "PAGE_IMAGE_RAW",
      filename: "drawing.png",
    })
    expect(captionedAsset).toMatchObject({
      kind: "PAGE_IMAGE",
      filename: "drawing.png",
    })
    const raw = await deps.storage.fetchBuffer(rawAsset!.storageLocator)
    const captioned = await deps.storage.fetchBuffer(
      captionedAsset!.storageLocator
    )
    const rawMeta = await sharp(raw).metadata()
    const captionedMeta = await sharp(captioned).metadata()
    expect(rawMeta).toMatchObject({ width: 1024, height: 512, format: "png" })
    expect(captionedMeta.height!).toBeGreaterThan(rawMeta.height!)
  })

  it("uses the story title as the cover caption", async () => {
    const cover = await deps.repos.pages.create({
      storyId,
      kind: "COVER",
      position: 0,
      text: "",
      imagePrompt: "",
      characterIds: [],
    })
    const uploaded = await uploadPageImage(deps, {
      userId,
      storyId,
      pageId: cover.id,
      file: file(await png()),
    })
    const rawAsset = await deps.repos.assets.getById(uploaded.rawAssetId!)
    const captionedAsset = await deps.repos.assets.getById(
      uploaded.imageAssetId
    )
    const rawMeta = await sharp(
      await deps.storage.fetchBuffer(rawAsset!.storageLocator)
    ).metadata()
    const captionedMeta = await sharp(
      await deps.storage.fetchBuffer(captionedAsset!.storageLocator)
    ).metadata()
    expect(captionedMeta.height!).toBeGreaterThan(rawMeta.height!)
  })

  it.each([
    ["unsupported MIME", file(Buffer.from("gif"), "image/gif")],
    [
      "oversized file",
      file(Buffer.alloc(MAX_PHOTO_BYTES + 1), "image/png", "large.png"),
    ],
  ])("rejects an %s", async (_label, invalidFile) => {
    await expect(
      uploadPageImage(deps, {
        userId,
        storyId,
        pageId,
        file: invalidFile,
      })
    ).rejects.toMatchObject({ code: "INVALID_UPLOAD" })
  })

  it("rejects foreign and mismatched story/page ownership", async () => {
    const foreignStory = await deps.repos.stories.create({
      userId: "someone-else",
      title: "Foreign",
      script: "Script",
    })
    const foreignPage = await deps.repos.pages.create({
      storyId: foreignStory.id,
      kind: "PAGE",
      position: 1,
      text: "",
      imagePrompt: "",
      characterIds: [],
    })
    const upload = file(await png())

    await expect(
      uploadPageImage(deps, {
        userId,
        storyId: foreignStory.id,
        pageId: foreignPage.id,
        file: upload,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(
      uploadPageImage(deps, {
        userId,
        storyId,
        pageId: foreignPage.id,
        file: upload,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("exposes an active generation as the route's conflict error", async () => {
    await deps.repos.tasks.create({
      userId,
      storyId,
      pageId,
      type: "PAGE_IMAGE",
      status: "RUNNING",
    })

    await expect(
      uploadPageImage(deps, {
        userId,
        storyId,
        pageId,
        file: file(await png()),
      })
    ).rejects.toEqual(
      expect.objectContaining({
        code: "ACTIVE_GENERATION",
      })
    )
  })

  it("lets a later AI generation take the next variant number", async () => {
    await uploadPageImage(deps, {
      userId,
      storyId,
      pageId,
      file: file(await png()),
    })

    const caller = createTestCaller({ user, deps })
    await caller.page.generate({ pageId })

    expect(await deps.repos.pages.listImages(pageId)).toMatchObject([
      { variant: 1, source: "UPLOAD", promptUsed: null },
      { variant: 2, source: "AI", promptUsed: "generated after upload" },
    ])
  })
})
