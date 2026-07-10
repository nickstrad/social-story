// @vitest-environment node

import { randomUUID } from "node:crypto"

import type { PrismaClient } from "@prisma/client"
import "dotenv/config"
import sharp from "sharp"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createTestCaller } from "@/server/api/test-utils"
import type { Deps } from "@/server/container"
import type { CreatePage, PageKind } from "@/server/domain/types"
import type { ImageGenerator, ReferenceImage } from "@/server/ports/image"
import { runPageImageTask } from "@/server/inngest/functions/pageImage"
import {
  fakeImageGenerator,
  immediateDispatcher,
} from "@/server/services/fakes"
import { inMemoryStorage } from "@/server/services/memory-storage"
import { baseImageKey, photoKey } from "@/server/services/storage-keys"
import { runTask } from "@/server/services/tasks"

const runIntegration = Boolean(process.env.DATABASE_URL)

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

describe.skipIf(!runIntegration)("page image integration", () => {
  let db: PrismaClient
  const userId = `page-test-${randomUUID()}`
  const storyId = `page-test-${randomUUID()}`

  function depsWith(image: ImageGenerator): Promise<Deps> {
    return (async () => {
      const { prismaRepos } = await import("@/server/repos/prisma")
      const { fakeTextGenerator } = await import("@/server/services/fakes")
      return {
        repos: prismaRepos(db),
        storage: inMemoryStorage(),
        text: fakeTextGenerator({}),
        image,
        dispatcher: immediateDispatcher(async () => {}),
      }
    })()
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

  beforeAll(async () => {
    const { db: database } = await import("@/server/db")
    db = database
    await db.user.create({
      data: { id: userId, name: "Page Test", email: `${userId}@example.com` },
    })
    await db.story.create({
      data: {
        id: storyId,
        userId,
        title: "My Story",
        script: "Script",
        baseImageUrl: null,
      },
    })
  })

  afterAll(async () => {
    if (!db) return
    await db.user.deleteMany({ where: { id: userId } })
    await db.$disconnect()
  })

  it("renders a peopled page: enforces TOGETHER, anchor-first refs, v1 selected, taller caption", async () => {
    const image = recordingImageGenerator(() => coloredPng(200, 100, 50))
    const deps = await depsWith(image)

    const ava = await deps.repos.characters.create({ storyId, name: "Ava" })
    const bo = await deps.repos.characters.create({ storyId, name: "Bo" })
    await deps.repos.rules.create({
      storyId,
      text: "Ava and Bo appear together",
      kind: "TOGETHER",
      characterIds: [ava.id, bo.id],
    })
    // Anchor sheet present → no extra photo attached even though Ava has one.
    const { url: baseUrl } = await deps.storage.put(
      baseImageKey(storyId),
      await coloredPng(1, 2, 3),
      "image/png"
    )
    await deps.repos.stories.update(storyId, { baseImageUrl: baseUrl })
    const { url: photoUrl } = await deps.storage.put(
      photoKey(storyId, ava.id),
      await coloredPng(9, 9, 9),
      "image/png"
    )
    await deps.repos.characters.update(ava.id, { photoUrl })

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
    const raw = await deps.storage.fetchBuffer(images[0].rawUrl!)
    const captioned = await deps.storage.fetchBuffer(images[0].url)
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

    await deps.repos.stories.update(storyId, { baseImageUrl: null })
    for (const character of await deps.repos.characters.listByStory(storyId)) {
      await deps.repos.characters.delete(character.id)
    }
    for (const rule of await deps.repos.rules.listByStory(storyId)) {
      await deps.repos.rules.delete(rule.id)
    }
  })

  it("renders a scene-only page: NO-people line and no references", async () => {
    const image = recordingImageGenerator(() => coloredPng(10, 20, 30))
    const deps = await depsWith(image)

    const page = await makePage(deps, { kind: "PAGE", characterIds: [] })
    const finished = await runFor(deps, page.id)

    expect(finished?.status).toBe("SUCCEEDED")
    const call = image.calls.at(-1)!
    expect(call.prompt).toContain("NO people")
    expect(call.referenceImages ?? []).toHaveLength(0)
  })

  it("renders a cover: title caption, coverNote in prompt, anchor attached", async () => {
    const image = recordingImageGenerator(() => coloredPng(40, 50, 60))
    const deps = await depsWith(image)
    // A cover counts as peopled, so a present base sheet is attached as a ref.
    const { url: baseUrl } = await deps.storage.put(
      baseImageKey(storyId),
      await coloredPng(1, 2, 3),
      "image/png"
    )
    await deps.repos.stories.update(storyId, {
      coverNote: "a gentle sunrise",
      baseImageUrl: baseUrl,
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
      baseImageUrl: null,
    })
  })

  it("fails the task and writes no PageImage when the generator throws", async () => {
    const image = recordingImageGenerator(async () => {
      throw new Error("image gen boom")
    })
    const deps = await depsWith(image)

    const page = await makePage(deps, { kind: "PAGE", characterIds: [] })
    const finished = await runFor(deps, page.id)

    expect(finished?.status).toBe("FAILED")
    expect(await deps.repos.pages.listImages(page.id)).toHaveLength(0)
  })

  it("rejects page.generate while a PAGE_IMAGE task is already active", async () => {
    const deps: Deps = {
      repos: (await import("@/server/repos/prisma")).prismaRepos(db),
      storage: inMemoryStorage(),
      text: (await import("@/server/services/fakes")).fakeTextGenerator({}),
      image: fakeImageGenerator(),
      // Never runs the task, so the manually-created task stays PENDING.
      dispatcher: immediateDispatcher(async () => {}),
    }
    const page = await makePage(deps, { kind: "PAGE", characterIds: [] })
    await deps.repos.tasks.create({
      userId,
      storyId,
      pageId: page.id,
      type: "PAGE_IMAGE",
      status: "PENDING",
    })

    const caller = createTestCaller({
      user: {
        id: userId,
        name: "Page Test",
        email: `${userId}@example.com`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        image: null,
      },
      deps,
    })
    await expect(caller.page.generate({ pageId: page.id })).rejects.toThrow(
      /already generating/i
    )
  })

  it("generateBulk skips pages that already have an active task", async () => {
    const deps: Deps = {
      repos: (await import("@/server/repos/prisma")).prismaRepos(db),
      storage: inMemoryStorage(),
      text: (await import("@/server/services/fakes")).fakeTextGenerator({}),
      image: fakeImageGenerator(),
      dispatcher: immediateDispatcher(async () => {}),
    }
    const busy = await makePage(deps, { kind: "PAGE", characterIds: [] })
    const free = await makePage(deps, { kind: "PAGE", characterIds: [] })
    await deps.repos.tasks.create({
      userId,
      storyId,
      pageId: busy.id,
      type: "PAGE_IMAGE",
      status: "RUNNING",
    })

    const caller = createTestCaller({
      user: {
        id: userId,
        name: "Page Test",
        email: `${userId}@example.com`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        image: null,
      },
      deps,
    })
    const result = await caller.page.generateBulk({
      storyId,
      pageIds: [busy.id, free.id],
    })
    expect(result.skipped).toEqual([busy.id])
    expect(result.taskIds).toHaveLength(1)
  })
})
