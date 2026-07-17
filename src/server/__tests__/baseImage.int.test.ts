// @vitest-environment node

import sharp from "sharp"
import { beforeAll, describe, expect, it } from "vitest"

import type { BaseImageGenerator } from "@/server/ai"
import { createFakeAiActions } from "@/server/ai/testing/fakes"
import type { Deps } from "@/server/container"
import type { Repos } from "@/server/ports/repos"
import { runBaseImageTask } from "@/server/inngest/functions/baseImage"
import { inMemoryRepos } from "@/server/repos/memory"
import { immediateDispatcher } from "@/server/services/fakes"
import { inMemoryStorage } from "@/server/services/memory-storage"
import { photoKey } from "@/server/services/storage-keys"
import { runTask, type TaskStepRunner } from "@/server/services/tasks"

// Self-sufficient integration test: in-memory repos + fake adapters, no real
// Postgres and no external APIs. Real-DB coverage lives in the Playwright E2E
// suite (docs/plans/completed/13-e2e-playwright.md).

async function tinyPng(): Promise<Buffer> {
  return sharp({
    create: {
      width: 4,
      height: 4,
      channels: 4,
      background: { r: 200, g: 100, b: 50, alpha: 1 },
    },
  })
    .png()
    .toBuffer()
}

interface RecordingBaseImageGenerator extends BaseImageGenerator {
  calls: Parameters<BaseImageGenerator["generate"]>[0][]
}

function recordingBaseImageGenerator(
  behavior: () => Promise<Buffer>
): RecordingBaseImageGenerator {
  const calls: RecordingBaseImageGenerator["calls"] = []
  return {
    calls,
    async generate(input) {
      calls.push(input)
      return { png: await behavior(), promptUsed: "recorded base image" }
    },
  }
}

describe("base image integration", () => {
  const userId = "base-user"
  let repos: Repos
  let storyId: string

  function baseDeps(image: BaseImageGenerator): Deps {
    return {
      repos,
      storage: inMemoryStorage(),
      ai: createFakeAiActions({ baseImage: image.generate.bind(image) }),
      dispatcher: immediateDispatcher(async () => {}),
    }
  }

  beforeAll(async () => {
    repos = inMemoryRepos()
    const story = await repos.stories.create({
      userId,
      title: "Base story",
      script: "Script",
    })
    storyId = story.id
  })

  async function seedCharacters(deps: Deps) {
    const photo = await tinyPng()
    const { locator } = await deps.storage.put(
      photoKey(storyId, "with-photo"),
      photo,
      "image/png"
    )
    const asset = await deps.repos.assets.create({
      userId,
      storyId,
      kind: "CHARACTER_PHOTO",
      storageLocator: locator,
      contentType: "image/png",
      byteLength: photo.byteLength,
    })
    await deps.repos.characters.create({
      storyId,
      name: "Ava",
      photoAssetId: asset.id,
    })
    await deps.repos.characters.create({ storyId, name: "Bo" })
    return { photo }
  }

  it("generates a sheet, passing photos and both names to the generator", async () => {
    const image = recordingBaseImageGenerator(tinyPng)
    const deps = baseDeps(image)
    const { photo } = await seedCharacters(deps)

    const task = await deps.repos.tasks.create({
      userId,
      storyId,
      type: "BASE_IMAGE",
    })
    await runTask(deps, task.id, runBaseImageTask)

    expect(image.calls).toHaveLength(1)
    const call = image.calls[0]
    expect(call.photos).toHaveLength(1)
    expect(call.photos[0].characterName).toBe("Ava")
    expect(call.photos[0].photo.data.equals(photo)).toBe(true)
    expect(call.characters.map(({ name }) => name)).toEqual(["Ava", "Bo"])
    expect(call.characters[0]).toEqual({
      name: "Ava",
      role: null,
      age: null,
      appearance: null,
    })

    const finished = await deps.repos.tasks.getById(task.id)
    expect(finished?.status).toBe("SUCCEEDED")
    const resultAssetId = (finished?.resultJson as { assetId: string } | null)
      ?.assetId
    expect(resultAssetId).toBeTruthy()
    const story = await deps.repos.stories.getById(storyId)
    expect(story?.baseImageAssetId).toBe(resultAssetId)

    const asset = await deps.repos.assets.getById(resultAssetId!)
    const stored = await deps.storage.fetchBuffer(asset!.storageLocator)
    expect(stored.length).toBeGreaterThan(0)

    const trace: Array<{ name: string; output: unknown }> = []
    const steps: TaskStepRunner = {
      async run(name, operation) {
        const output = await operation()
        trace.push({ name, output })
        return output
      },
    }
    await runBaseImageTask(task, deps, steps)
    expect(trace[0].name).toBe(
      "Generate and save character reference sheet with AI"
    )
    expect(trace[0].output).toMatchObject({
      request: { characterCount: 2, referencePhotoCount: 1 },
      response: { imageBytes: expect.any(Number) },
    })
    const visibleTrace = JSON.stringify(trace)
    expect(visibleTrace).not.toContain("Ava")
    expect(visibleTrace).not.toContain("Bo")
    expect(visibleTrace).not.toContain(photo.toString("base64"))
    expect(visibleTrace).not.toContain("recorded base image")

    // Cleanup characters for the failure test below.
    for (const character of await deps.repos.characters.listByStory(storyId)) {
      await deps.repos.characters.delete(character.id)
    }
    await deps.repos.stories.update(storyId, { baseImageAssetId: null })
  })

  it("leaves baseImageAssetId unchanged when generation fails", async () => {
    const image = recordingBaseImageGenerator(async () => {
      throw new Error("image gen boom")
    })
    const deps = baseDeps(image)
    await deps.repos.characters.create({ storyId, name: "Cy" })
    const keep = await deps.repos.assets.create({
      userId,
      storyId,
      kind: "BASE_IMAGE",
      storageLocator: "keep-me",
      contentType: "image/png",
      byteLength: 1,
    })
    await deps.repos.stories.update(storyId, {
      baseImageAssetId: keep.id,
    })

    const task = await deps.repos.tasks.create({
      userId,
      storyId,
      type: "BASE_IMAGE",
    })
    await runTask(deps, task.id, runBaseImageTask)

    const finished = await deps.repos.tasks.getById(task.id)
    expect(finished?.status).toBe("FAILED")
    const story = await deps.repos.stories.getById(storyId)
    expect(story?.baseImageAssetId).toBe(keep.id)
  })
})
