// @vitest-environment node

import { randomUUID } from "node:crypto"

import type { PrismaClient } from "@prisma/client"
import "dotenv/config"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createTestCaller } from "@/server/api/test-utils"
import type { Deps } from "@/server/container"
import type { ParsedStory } from "@/server/domain/schemas"
import { getTaskHandler } from "@/server/inngest/handlers"
// Import for side effects: registers the PARSE_STORY handler.
import "@/server/inngest/functions/parseStory"
import {
  fakeImageGenerator,
  fakeTextGenerator,
  immediateDispatcher,
} from "@/server/services/fakes"
import { inMemoryStorage } from "@/server/services/memory-storage"
import { runTask } from "@/server/services/tasks"

const runIntegration = Boolean(process.env.DATABASE_URL)

const SCRIPT = "Sam and Mia visit the dentist. Then they go home."

const parsed: ParsedStory = {
  title: "The Dentist Visit",
  pages: [
    {
      page: 1,
      text: "Sam sits in the big chair.",
      imagePrompt: "A child in a dentist chair",
      characterNames: ["Sam"],
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

describe.skipIf(!runIntegration)("parse integration", () => {
  let db: PrismaClient
  let deps: Deps
  const userId = `parse-test-${randomUUID()}`
  const user = {
    id: userId,
    name: "Parse Test User",
    email: `${userId}@example.com`,
    emailVerified: true,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeAll(async () => {
    const [{ db: database }, { prismaRepos }] = await Promise.all([
      import("@/server/db"),
      import("@/server/repos/prisma"),
    ])
    db = database
    await db.user.create({
      data: { id: userId, name: user.name, email: user.email },
    })
    const repos = prismaRepos(db)
    deps = {
      repos,
      storage: inMemoryStorage(),
      text: fakeTextGenerator({ [SCRIPT]: parsed }),
      image: fakeImageGenerator(),
      dispatcher: immediateDispatcher(async (taskId) => {
        const task = await repos.tasks.getById(taskId)
        const handler = task && getTaskHandler(task.type)
        if (handler) await runTask(deps, taskId, handler)
      }),
    }
  })

  afterAll(async () => {
    if (!db) return
    await db.user.delete({ where: { id: userId } })
    await db.$disconnect()
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
  })

  it("refuses to re-parse when a page already has a generated image", async () => {
    const caller = createTestCaller({ user, deps })
    const story = await caller.story.create({
      title: "Keep me",
      script: SCRIPT,
    })
    await caller.story.parse({ storyId: story.id })

    const pages = await deps.repos.pages.listByStory(story.id)
    await deps.repos.pages.addImage({
      pageId: pages[1].id,
      url: "https://blob/page.png",
      promptUsed: "prompt",
      variant: 1,
    })

    const { taskId } = await caller.story.parse({ storyId: story.id })
    const task = await deps.repos.tasks.getById(taskId)
    expect(task?.status).toBe("FAILED")
    expect(task?.error).toMatch(/already have generated images/)
  })
})
