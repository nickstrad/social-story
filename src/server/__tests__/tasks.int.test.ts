// @vitest-environment node

import { randomUUID } from "node:crypto"

import type { PrismaClient } from "@prisma/client"
import "dotenv/config"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createTestCaller } from "@/server/api/test-utils"
import type { Deps } from "@/server/container"
import { getTaskHandler, registerTaskHandler } from "@/server/inngest/handlers"
import {
  fakeImageGenerator,
  fakeTextGenerator,
  immediateDispatcher,
} from "@/server/services/fakes"
import { inMemoryStorage } from "@/server/services/memory-storage"
import { createTask, runTask } from "@/server/services/tasks"

const runIntegration = Boolean(process.env.DATABASE_URL)

describe.skipIf(!runIntegration)("task integration", () => {
  let db: PrismaClient
  let deps: Deps
  const userId = `task-test-${randomUUID()}`
  const otherUserId = `task-test-${randomUUID()}`
  const storyId = `task-test-${randomUUID()}`
  const otherStoryId = `task-test-${randomUUID()}`
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
    const [{ db: database }, { prismaRepos }] = await Promise.all([
      import("@/server/db"),
      import("@/server/repos/prisma"),
    ])
    db = database
    await db.user.createMany({
      data: [
        { id: userId, name: user.name, email: user.email },
        {
          id: otherUserId,
          name: "Other User",
          email: `${otherUserId}@example.com`,
        },
      ],
    })
    await db.story.createMany({
      data: [
        { id: storyId, userId, title: "Task story", script: "Script" },
        {
          id: otherStoryId,
          userId: otherUserId,
          title: "Other story",
          script: "Script",
        },
      ],
    })
    deps = {
      repos: prismaRepos(db),
      storage: inMemoryStorage(),
      text: fakeTextGenerator({}),
      image: fakeImageGenerator(),
      dispatcher: immediateDispatcher(async () => {}),
    }
  })

  afterAll(async () => {
    if (!db) return
    await db.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } })
    await db.$disconnect()
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
