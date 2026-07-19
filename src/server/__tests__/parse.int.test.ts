// @vitest-environment node

import { beforeAll, describe, expect, it } from "vitest"

import type { StoryToData } from "@/server/ai"
import { createTestCaller } from "@/server/api/test-utils"
import { createFakeAiActions } from "@/server/ai/testing/fakes"
import type { Deps } from "@/server/container"
import type { ParsedStory } from "@/server/domain/schemas"
import { getTaskHandler } from "@/server/inngest/handlers"
import { runParseStoryTask } from "@/server/inngest/functions/parseStory"
import { inMemoryRepos } from "@/server/repos/memory"
import { immediateDispatcher } from "@/server/services/fakes"
import { inMemoryStorage } from "@/server/services/memory-storage"
import { runTask, type TaskStepRunner } from "@/server/services/tasks"

// Self-sufficient integration test: in-memory repos + fake adapters, no real
// Postgres and no external APIs. Real-DB coverage lives in the Playwright E2E
// suite (docs/plans/completed/13-e2e-playwright.md).

const SCRIPT = "Sam and Mia visit the dentist. Then they go home."

const parsed: ParsedStory = {
  title: "The Dentist Visit",
  pages: [
    {
      page: 1,
      text: "Sam sits in the big chair.",
      imagePrompt: "A child in a dentist chair",
      // Casing and stray whitespace must still resolve to the roster character.
      characterNames: ["  sam "],
    },
    {
      page: 2,
      text: "A stranger waves hello.",
      imagePrompt: "A waving figure",
      characterNames: ["Ghost"],
    },
    {
      page: 3,
      text: "The waiting room is calm.",
      imagePrompt: "An empty calm waiting room",
      characterNames: [],
    },
  ],
}

const storyToDataInputs: Parameters<StoryToData["convert"]>[0][] = []

describe("parse integration", () => {
  let deps: Deps
  const userId = "parse-user"
  const user = {
    id: userId,
    name: "Parse Test User",
    email: `${userId}@example.com`,
    emailVerified: true,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeAll(() => {
    const repos = inMemoryRepos()
    deps = {
      repos,
      storage: inMemoryStorage(),
      ai: createFakeAiActions({
        storyToData: async (input) => {
          storyToDataInputs.push(input)
          return parsed
        },
      }),
      dispatcher: immediateDispatcher(async (taskId) => {
        const task = await repos.tasks.getById(taskId)
        const handler = task && getTaskHandler(task.type)
        if (handler) await runTask(deps, taskId, handler)
      }),
    }
  })

  it("parses a script into ordered pages, dropping unknown names and applying rules", async () => {
    const caller = createTestCaller({ user, deps })
    // Empty title so the parse result names the story.
    const story = await caller.story.create({ script: SCRIPT })

    const sam = await deps.repos.characters.create({
      storyId: story.id,
      name: "Sam",
    })
    const mia = await deps.repos.characters.create({
      storyId: story.id,
      name: "Mia",
    })
    await deps.repos.rules.create({
      storyId: story.id,
      text: "Sam and Mia always appear together",
      kind: "TOGETHER",
      characterIds: [sam.id, mia.id],
    })

    const { taskId } = await caller.story.parse({ storyId: story.id })

    const task = await deps.repos.tasks.getById(taskId)
    expect(task).toMatchObject({
      status: "SUCCEEDED",
      resultJson: { pageCount: 4 },
    })

    const pages = await deps.repos.pages.listByStory(story.id)
    expect(pages.map((page) => page.position)).toEqual([0, 1, 2, 3])
    expect(pages[0]).toMatchObject({ kind: "COVER", position: 0 })
    // TOGETHER rule pulls Mia in alongside Sam.
    expect(pages[1].characterIds).toEqual([sam.id, mia.id])
    // Unknown "Ghost" is dropped.
    expect(pages[2].characterIds).toEqual([])
    expect(pages[3].characterIds).toEqual([])

    const refreshed = await deps.repos.stories.getById(story.id)
    expect(refreshed).toMatchObject({ status: "PARSED", title: parsed.title })

    const trace: Array<{ name: string; output: unknown }> = []
    const recordingSteps: TaskStepRunner = {
      async run(name, operation) {
        const output = await operation()
        trace.push({ name, output })
        return output
      },
    }
    if (!task) throw new Error("Expected parse task")
    await runParseStoryTask(task, deps, recordingSteps)

    // The off-roster "Ghost" is counted rather than silently dropped — and the
    // name itself stays out of the durable step result.
    expect(trace.at(-1)?.output).toMatchObject({
      response: { unmatchedCharacterNameCount: 1 },
    })

    const visibleTrace = JSON.stringify(trace)
    expect(visibleTrace).not.toContain("Ghost")
    expect(visibleTrace).toContain("request")
    expect(visibleTrace).toContain("response")
    expect(visibleTrace).toContain("scriptCharacterCount")
    expect(visibleTrace).not.toContain(SCRIPT)
    expect(visibleTrace).not.toContain(parsed.title)
    expect(visibleTrace).not.toContain("Sam")
    expect(visibleTrace).not.toContain("Mia")
    expect(storyToDataInputs.at(-1)?.characters[0]).toEqual({
      name: "Sam",
      role: null,
      age: null,
      appearance: null,
    })
    expect(storyToDataInputs.at(-1)?.rules[0]).toEqual({
      kind: "TOGETHER",
      text: "Sam and Mia always appear together",
    })
  })

  it("refuses to re-parse when a page already has a generated image", async () => {
    const caller = createTestCaller({ user, deps })
    const story = await caller.story.create({
      title: "Keep me",
      script: SCRIPT,
    })
    await caller.story.parse({ storyId: story.id })

    const pages = await deps.repos.pages.listByStory(story.id)
    const asset = await deps.repos.assets.create({
      userId: user.id,
      storyId: story.id,
      kind: "PAGE_IMAGE",
      storageLocator: "private/page.png",
      contentType: "image/png",
      byteLength: 1,
    })
    await deps.repos.pages.addImage({
      pageId: pages[1].id,
      imageAssetId: asset.id,
      promptUsed: "prompt",
      variant: 1,
    })

    const { taskId } = await caller.story.parse({ storyId: story.id })
    const task = await deps.repos.tasks.getById(taskId)
    expect(task?.status).toBe("FAILED")
    expect(task?.error).toMatch(/already have generated images/)
  })
})
