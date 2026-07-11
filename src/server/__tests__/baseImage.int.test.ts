// @vitest-environment node

import sharp from "sharp"
import { beforeAll, describe, expect, it } from "vitest"

import type { Deps } from "@/server/container"
import type { ImageGenerator, ReferenceImage } from "@/server/ports/image"
import type { Repos } from "@/server/ports/repos"
import { runBaseImageTask } from "@/server/inngest/functions/baseImage"
import { inMemoryRepos } from "@/server/repos/memory"
import { fakeTextGenerator, immediateDispatcher } from "@/server/services/fakes"
import { inMemoryStorage } from "@/server/services/memory-storage"
import { photoKey } from "@/server/services/storage-keys"
import { runTask } from "@/server/services/tasks"

// Self-sufficient integration test: in-memory repos + fake adapters, no real
// Postgres and no external APIs. Real-DB coverage lives in the Playwright E2E
// suite (docs/13-e2e-playwright.md).

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

describe("base image integration", () => {
  const userId = "base-user"
  let repos: Repos
  let storyId: string

  function baseDeps(image: ImageGenerator): Deps {
    return {
      repos,
      storage: inMemoryStorage(),
      text: fakeTextGenerator({}),
      image,
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
    const { url } = await deps.storage.put(
      photoKey(storyId, "with-photo"),
      photo,
      "image/png"
    )
    await deps.repos.characters.create({
      storyId,
      name: "Ava",
      photoUrl: url,
    })
    await deps.repos.characters.create({ storyId, name: "Bo" })
    return { photo }
  }

  it("generates a sheet, passing photos and both names to the generator", async () => {
    const image = recordingImageGenerator(tinyPng)
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
    expect(call.referenceImages).toHaveLength(1)
    expect(call.referenceImages?.[0].data.equals(photo)).toBe(true)
    expect(call.prompt).toContain("Ava")
    expect(call.prompt).toContain("Bo")

    const finished = await deps.repos.tasks.getById(task.id)
    expect(finished?.status).toBe("SUCCEEDED")
    const resultUrl = (finished?.resultJson as { url: string } | null)?.url
    expect(resultUrl).toBeTruthy()
    const story = await deps.repos.stories.getById(storyId)
    expect(story?.baseImageUrl).toBe(resultUrl)

    // The generated sheet was actually written to storage under resultUrl.
    const stored = await deps.storage.fetchBuffer(resultUrl!)
    expect(stored.length).toBeGreaterThan(0)

    // Cleanup characters for the failure test below.
    for (const character of await deps.repos.characters.listByStory(storyId)) {
      await deps.repos.characters.delete(character.id)
    }
    await deps.repos.stories.update(storyId, { baseImageUrl: null })
  })

  it("leaves baseImageUrl unchanged when generation fails", async () => {
    const image = recordingImageGenerator(async () => {
      throw new Error("image gen boom")
    })
    const deps = baseDeps(image)
    await deps.repos.characters.create({ storyId, name: "Cy" })
    await deps.repos.stories.update(storyId, { baseImageUrl: "keep-me" })

    const task = await deps.repos.tasks.create({
      userId,
      storyId,
      type: "BASE_IMAGE",
    })
    await runTask(deps, task.id, runBaseImageTask)

    const finished = await deps.repos.tasks.getById(task.id)
    expect(finished?.status).toBe("FAILED")
    const story = await deps.repos.stories.getById(storyId)
    expect(story?.baseImageUrl).toBe("keep-me")
  })
})
