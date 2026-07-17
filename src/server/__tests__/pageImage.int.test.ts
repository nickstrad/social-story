// @vitest-environment node

import sharp from "sharp"
import { beforeAll, describe, expect, it } from "vitest"

import type { CoverImageGenerator, PageImageGenerator } from "@/server/ai"
import { createFakeAiActions, fakeArtwork } from "@/server/ai/testing/fakes"
import { createTestCaller } from "@/server/api/test-utils"
import type { Deps } from "@/server/container"
import type { CreatePage, PageKind } from "@/server/domain/types"
import type { Repos } from "@/server/ports/repos"
import { runPageImageTask } from "@/server/inngest/functions/pageImage"
import { inMemoryRepos } from "@/server/repos/memory"
import { immediateDispatcher } from "@/server/services/fakes"
import { inMemoryStorage } from "@/server/services/memory-storage"
import { baseImageKey, photoKey } from "@/server/services/storage-keys"
import { runTask, type TaskStepRunner } from "@/server/services/tasks"

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

interface RecordingImageActions {
  pageCalls: Parameters<PageImageGenerator["generate"]>[0][]
  coverCalls: Parameters<CoverImageGenerator["generate"]>[0][]
  pageImage: PageImageGenerator["generate"]
  coverImage: CoverImageGenerator["generate"]
}

function recordingImageActions(
  behavior: () => Promise<Buffer>
): RecordingImageActions {
  const pageCalls: RecordingImageActions["pageCalls"] = []
  const coverCalls: RecordingImageActions["coverCalls"] = []
  return {
    pageCalls,
    coverCalls,
    async pageImage(input) {
      pageCalls.push(input)
      return { png: await behavior(), promptUsed: "recorded page image" }
    },
    async coverImage(input) {
      coverCalls.push(input)
      return { png: await behavior(), promptUsed: "recorded cover image" }
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

  function depsWith(image?: RecordingImageActions): Deps {
    return {
      repos,
      storage: inMemoryStorage(),
      ai: createFakeAiActions({
        pageImage: image?.pageImage ?? (async () => fakeArtwork()),
        coverImage: image?.coverImage ?? (async () => fakeArtwork()),
      }),
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
    const image = recordingImageActions(() => coloredPng(200, 100, 50))
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
    const call = image.pageCalls.at(-1)!
    expect(call.pageCharacters.map(({ name }) => name)).toEqual(["Ava", "Bo"])
    expect(call.pageCharacters[0]).toEqual({
      name: "Ava",
      role: null,
      age: null,
      appearance: null,
    })
    expect(call.rules[0]).toEqual({
      kind: "TOGETHER",
      text: "Ava and Bo appear together",
    })
    // Anchor present → exactly one reference (the sheet), no character photo.
    expect(call.anchorImage).toBeDefined()
    expect(call.characterPhoto).toBeUndefined()

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

    const trace: Array<{ name: string; output: unknown }> = []
    const steps: TaskStepRunner = {
      async run(name, operation) {
        const output = await operation()
        trace.push({ name, output })
        return output
      },
    }
    const tracedTask = await deps.repos.tasks.create({
      userId,
      storyId,
      pageId: page.id,
      type: "PAGE_IMAGE",
    })
    await runPageImageTask(tracedTask, deps, steps)
    expect(trace[0].name).toBe("Generate and save page illustration with AI")
    expect(trace[0].output).toMatchObject({
      request: {
        pageKind: "PAGE",
        characterCount: 2,
        referenceImageCount: 1,
      },
      response: {
        pageImageId: expect.any(String),
        rawImageBytes: expect.any(Number),
        captionedImageBytes: expect.any(Number),
      },
    })
    const visibleTrace = JSON.stringify(trace)
    expect(visibleTrace).not.toContain("Ava")
    expect(visibleTrace).not.toContain("Bo")
    expect(visibleTrace).not.toContain("Ava waving in a park")
    expect(visibleTrace).not.toContain("recorded page image")

    await deps.repos.stories.update(storyId, { baseImageAssetId: null })
    for (const character of await deps.repos.characters.listByStory(storyId)) {
      await deps.repos.characters.delete(character.id)
    }
    for (const rule of await deps.repos.rules.listByStory(storyId)) {
      await deps.repos.rules.delete(rule.id)
    }
  })

  it("renders a scene-only page: NO-people line and no references", async () => {
    const image = recordingImageActions(() => coloredPng(10, 20, 30))
    const deps = depsWith(image)

    const page = await makePage(deps, { kind: "PAGE", characterIds: [] })
    const finished = await runFor(deps, page.id)

    expect(finished?.status).toBe("SUCCEEDED")
    const call = image.pageCalls.at(-1)!
    expect(call.pageCharacters).toHaveLength(0)
    expect(call.anchorImage).toBeUndefined()
    expect(call.characterPhoto).toBeUndefined()
  })

  it("renders a cover: title caption, coverNote in prompt, anchor attached", async () => {
    const image = recordingImageActions(() => coloredPng(40, 50, 60))
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
    const call = image.coverCalls.at(-1)!
    expect(call.title).toBe("My Story")
    expect(call.note).toBe("a gentle sunrise")
    expect(call.anchorImage).toBeDefined()
    expect(image.pageCalls).toHaveLength(0)

    await deps.repos.stories.update(storyId, {
      coverNote: null,
      baseImageAssetId: null,
    })
  })

  it("fails the task and writes no PageImage when the generator throws", async () => {
    const image = recordingImageActions(async () => {
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
    const deps = depsWith()
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
    const deps = depsWith()
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
