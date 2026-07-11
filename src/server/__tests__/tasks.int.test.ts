// @vitest-environment node

import { beforeAll, describe, expect, it } from "vitest"

import { createTestCaller } from "@/server/api/test-utils"
import type { Deps } from "@/server/container"
import { getTaskHandler, registerTaskHandler } from "@/server/inngest/handlers"
import { inMemoryRepos } from "@/server/repos/memory"
import {
  fakeImageGenerator,
  fakeTextGenerator,
  immediateDispatcher,
} from "@/server/services/fakes"
import { inMemoryStorage } from "@/server/services/memory-storage"
import { createTask, runTask } from "@/server/services/tasks"

// Self-sufficient integration test: in-memory repos + fake adapters, no real
// Postgres and no external APIs. Real-DB coverage lives in the Playwright E2E
// suite (docs/13-e2e-playwright.md).

describe("task integration", () => {
  let deps: Deps
  const userId = "task-user"
  const otherUserId = "task-other-user"
  let storyId: string
  let otherStoryId: string
  const user = {
    id: userId,
    name: "Task Test User",
    email: `${userId}@example.com`,
    emailVerified: true,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeAll(async () => {
    deps = {
      repos: inMemoryRepos(),
      storage: inMemoryStorage(),
      text: fakeTextGenerator({}),
      image: fakeImageGenerator(),
      dispatcher: immediateDispatcher(async () => {}),
    }
    const story = await deps.repos.stories.create({
      userId,
      title: "Task story",
      script: "Script",
    })
    const otherStory = await deps.repos.stories.create({
      userId: otherUserId,
      title: "Other story",
      script: "Script",
    })
    storyId = story.id
    otherStoryId = otherStory.id
  })

  it("runs a created task inline through the registered handler", async () => {
    registerTaskHandler("PARSE_STORY", async () => ({ parsed: true }))
    deps.dispatcher = immediateDispatcher(async (taskId) => {
      const task = await deps.repos.tasks.getById(taskId)
      const handler = task && getTaskHandler(task.type)
      if (handler) await runTask(deps, taskId, handler)
    })

    const created = await createTask(deps, {
      userId,
      storyId,
      type: "PARSE_STORY",
    })

    expect(await deps.repos.tasks.getById(created.id)).toMatchObject({
      status: "SUCCEEDED",
      resultJson: { parsed: true },
    })
  })

  it("retries a failed task as a fresh pending task", async () => {
    deps.dispatcher = immediateDispatcher(async () => {})
    const failed = await deps.repos.tasks.create({
      userId,
      storyId,
      type: "PAGE_IMAGE",
      status: "FAILED",
      error: "failed",
    })

    const retried = await createTestCaller({ user, deps }).task.retry({
      taskId: failed.id,
    })

    expect(retried).toMatchObject({ status: "PENDING", type: failed.type })
    expect(retried.id).not.toBe(failed.id)
  })

  it("hides another user's task", async () => {
    const task = await deps.repos.tasks.create({
      userId: otherUserId,
      storyId: otherStoryId,
      type: "PDF_EXPORT",
    })

    await expect(
      createTestCaller({ user, deps }).task.get({ taskId: task.id })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})
