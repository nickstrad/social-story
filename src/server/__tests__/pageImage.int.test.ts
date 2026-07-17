// @vitest-environment node

import sharp from "sharp"
import { beforeAll, describe, expect, it } from "vitest"

import { createTestCaller } from "@/server/api/test-utils"
import type { Deps } from "@/server/container"
import type { CreatePage, PageKind } from "@/server/domain/types"
import type { ImageGenerator, ReferenceImage } from "@/server/ports/image"
import type { Repos } from "@/server/ports/repos"
import { runPageImageTask } from "@/server/inngest/functions/pageImage"
import { inMemoryRepos } from "@/server/repos/memory"
import {
  fakeImageGenerator,
  fakeTextGenerator,
  immediateDispatcher,
} from "@/server/services/fakes"
import { inMemoryStorage } from "@/server/services/memory-storage"
import { baseImageKey, photoKey } from "@/server/services/storage-keys"
import { runTask } from "@/server/services/tasks"

// Self-sufficient integration test: in-memory repos + fake adapters, no real
// Postgres and no external APIs. Real-DB coverage lives in the Playwright E2E
// suite (docs/plans/completed/13-e2e-playwright.md).

async function coloredPng(r: number, g: number, b: number): Promise<Buffer> {
  return sharp({
    create: {
      width: 8,
      height: 8,
      channels: 4,
      background: { r, g, b, alpha: 1 },
    },
  })
    .png()
    .toBuffer()
}

interface RecordingImageGenerator extends ImageGenerator {
  calls: { prompt: string; referenceImages?: ReferenceImage[] }[]
}

function recordingImageGenerator(
  behavior: () => Promise<Buffer>
): RecordingImageGenerator {
  const calls: RecordingImageGenerator["calls"] = []
  return {
    calls,
    async generate(args) {
      calls.push({ prompt: args.prompt, referenceImages: args.referenceImages })
      return behavior()
    },
  }
}

describe("page image integration", () => {
  const userId = "page-user"
  let repos: Repos
  let storyId: string

  const user = {
    id: userId,
    name: "Page Test",
    email: `${userId}@example.com`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    image: null,
  }

  function depsWith(image: ImageGenerator): Deps {
    return {
      repos,
      storage: inMemoryStorage(),
      text: fakeTextGenerator({}),
      image,
      dispatcher: immediateDispatcher(async () => {}),
    }
  }

  async function makePage(
    deps: Deps,
    overrides: Partial<CreatePage> & { kind: PageKind }
  ) {
    return deps.repos.pages.create({
      storyId,
      position: overrides.kind === "COVER" ? 0 : 1,
      text: "Ava waves hello.",
      imagePrompt: "Ava waving in a park",
      characterIds: [],
      ...overrides,
    })
  }

  async function runFor(deps: Deps, pageId: string) {
    const task = await deps.repos.tasks.create({
      userId,
      storyId,
      pageId,
      type: "PAGE_IMAGE",
    })
    await runTask(deps, task.id, runPageImageTask)
    return deps.repos.tasks.getById(task.id)
  }

  async function storeAsset(
    deps: Deps,
    kind: "BASE_IMAGE" | "CHARACTER_PHOTO",
    key: string,
    bytes: Buffer
  ) {
    const { locator } = await deps.storage.put(
      `${key}-${crypto.randomUUID()}`,
      bytes,
      "image/png"
    )
    return deps.repos.assets.create({
      userId,
      storyId,
      kind,
      storageLocator: locator,
      contentType: "image/png",
      byteLength: bytes.byteLength,
    })
  }

  beforeAll(async () => {
    repos = inMemoryRepos()
    const story = await repos.stories.create({
      userId,
      title: "My Story",
      script: "Script",
    })
    storyId = story.id
  })

  it("renders a peopled page: enforces TOGETHER, anchor-first refs, v1 selected, taller caption", async () => {
    const image = recordingImageGenerator(() => coloredPng(200, 100, 50))
    const deps = depsWith(image)

    const ava = await deps.repos.characters.create({ storyId, name: "Ava" })
    const bo = await deps.repos.characters.create({ storyId, name: "Bo" })
    await deps.repos.rules.create({
      storyId,
      text: "Ava and Bo appear together",
      kind: "TOGETHER",
      characterIds: [ava.id, bo.id],
    })
    // Anchor sheet present → no extra photo attached even though Ava has one.
    const base = await storeAsset(
      deps,
      "BASE_IMAGE",
      baseImageKey(storyId),
      await coloredPng(1, 2, 3)
    )
    await deps.repos.stories.update(storyId, {
      baseImageAssetId: base.id,
    })
    const photo = await storeAsset(
      deps,
      "CHARACTER_PHOTO",
      photoKey(storyId, ava.id),
      await coloredPng(9, 9, 9)
    )
    await deps.repos.characters.update(ava.id, { photoAssetId: photo.id })

    // Page names only Ava; TOGETHER must pull Bo into the prompt.
    const page = await makePage(deps, { kind: "PAGE", characterIds: [ava.id] })
    const finished = await runFor(deps, page.id)

    expect(finished?.status).toBe("SUCCEEDED")
    const call = image.calls.at(-1)!
    expect(call.prompt).toContain("Ava")
    expect(call.prompt).toContain("Bo")
    // Anchor present → exactly one reference (the sheet), no character photo.
    expect(call.referenceImages).toHaveLength(1)

    const images = await deps.repos.pages.listImages(page.id)
    expect(images).toHaveLength(1)
    expect(images[0].variant).toBe(1)
    const reloaded = await deps.repos.pages.getById(page.id)
    expect(reloaded?.selectedImageId).toBe(images[0].id)
    // The handler's return is persisted as the task's resultJson (plan step 6).
    expect(finished?.resultJson).toEqual({ pageImageId: images[0].id })

    // Captioned image is taller than the raw source (caption band appended).
    const [rawAsset, captionedAsset] = await Promise.all([
      deps.repos.assets.getById(images[0].rawAssetId!),
      deps.repos.assets.getById(images[0].imageAssetId),
    ])
    const raw = await deps.storage.fetchBuffer(rawAsset!.storageLocator)
    const captioned = await deps.storage.fetchBuffer(
      captionedAsset!.storageLocator
    )
    const rawMeta = await sharp(raw).metadata()
    const capMeta = await sharp(captioned).metadata()
    expect(capMeta.height!).toBeGreaterThan(rawMeta.height!)

    // Second run → v2, selection flips, v1 retained.
    const second = await runFor(deps, page.id)
    expect(second?.status).toBe("SUCCEEDED")
    const afterSecond = await deps.repos.pages.listImages(page.id)
    expect(afterSecond.map((i) => i.variant).sort()).toEqual([1, 2])
    const reloaded2 = await deps.repos.pages.getById(page.id)
    const v2 = afterSecond.find((i) => i.variant === 2)!
    expect(reloaded2?.selectedImageId).toBe(v2.id)

    await deps.repos.stories.update(storyId, { baseImageAssetId: null })
    for (const character of await deps.repos.characters.listByStory(storyId)) {
      await deps.repos.characters.delete(character.id)
    }
    for (const rule of await deps.repos.rules.listByStory(storyId)) {
      await deps.repos.rules.delete(rule.id)
    }
  })

  it("renders a scene-only page: NO-people line and no references", async () => {
    const image = recordingImageGenerator(() => coloredPng(10, 20, 30))
    const deps = depsWith(image)

    const page = await makePage(deps, { kind: "PAGE", characterIds: [] })
    const finished = await runFor(deps, page.id)

    expect(finished?.status).toBe("SUCCEEDED")
    const call = image.calls.at(-1)!
    expect(call.prompt).toContain("NO people")
    expect(call.referenceImages ?? []).toHaveLength(0)
  })

  it("renders a cover: title caption, coverNote in prompt, anchor attached", async () => {
    const image = recordingImageGenerator(() => coloredPng(40, 50, 60))
    const deps = depsWith(image)
    // A cover counts as peopled, so a present base sheet is attached as a ref.
    const base = await storeAsset(
      deps,
      "BASE_IMAGE",
      baseImageKey(storyId),
      await coloredPng(1, 2, 3)
    )
    await deps.repos.stories.update(storyId, {
      coverNote: "a gentle sunrise",
      baseImageAssetId: base.id,
    })

    const cover = await makePage(deps, {
      kind: "COVER",
      text: "My Story",
      imagePrompt: "My Story",
    })
    const finished = await runFor(deps, cover.id)

    expect(finished?.status).toBe("SUCCEEDED")
    const call = image.calls.at(-1)!
    expect(call.prompt).toContain("My Story")
    expect(call.prompt).toContain("a gentle sunrise")
    expect(call.referenceImages).toHaveLength(1)

    await deps.repos.stories.update(storyId, {
      coverNote: null,
      baseImageAssetId: null,
    })
  })

  it("fails the task and writes no PageImage when the generator throws", async () => {
    const image = recordingImageGenerator(async () => {
      throw new Error("image gen boom")
    })
    const deps = depsWith(image)

    const page = await makePage(deps, { kind: "PAGE", characterIds: [] })
    const finished = await runFor(deps, page.id)

    expect(finished?.status).toBe("FAILED")
    expect(await deps.repos.pages.listImages(page.id)).toHaveLength(0)
  })

  it("rejects page.generate while a PAGE_IMAGE task is already active", async () => {
    // Never runs the task, so the manually-created task stays PENDING.
    const deps = depsWith(fakeImageGenerator())
    const page = await makePage(deps, { kind: "PAGE", characterIds: [] })
    await deps.repos.tasks.create({
      userId,
      storyId,
      pageId: page.id,
      type: "PAGE_IMAGE",
      status: "PENDING",
    })

    const caller = createTestCaller({ user, deps })
    await expect(caller.page.generate({ pageId: page.id })).rejects.toThrow(
      /already generating/i
    )
  })

  it("generateBulk skips pages that already have an active task", async () => {
    const deps = depsWith(fakeImageGenerator())
    const busy = await makePage(deps, { kind: "PAGE", characterIds: [] })
    const free = await makePage(deps, { kind: "PAGE", characterIds: [] })
    await deps.repos.tasks.create({
      userId,
      storyId,
      pageId: busy.id,
      type: "PAGE_IMAGE",
      status: "RUNNING",
    })

    const caller = createTestCaller({ user, deps })
    const result = await caller.page.generateBulk({
      storyId,
      pageIds: [busy.id, free.id],
    })
    expect(result.skipped).toEqual([busy.id])
    expect(result.taskIds).toHaveLength(1)
  })
})
