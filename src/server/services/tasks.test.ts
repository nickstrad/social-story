// @vitest-environment node

import { describe, expect, it, vi } from "vitest"

import type { Deps } from "@/server/container"
import { inMemoryRepos } from "@/server/repos/memory"
import {
  fakeImageGenerator,
  fakeTextGenerator,
  immediateDispatcher,
} from "@/server/services/fakes"
import { inMemoryStorage } from "@/server/services/memory-storage"

import { runTask } from "./tasks"

function makeDeps(): Deps {
  return {
    repos: inMemoryRepos(),
    storage: inMemoryStorage(),
    text: fakeTextGenerator({}),
    image: fakeImageGenerator(),
    dispatcher: immediateDispatcher(async () => {}),
  }
}

async function pendingTask(deps: Deps) {
  return deps.repos.tasks.create({
    userId: "user-1",
    storyId: "story-1",
    type: "PARSE_STORY",
  })
}

describe("runTask", () => {
  it("runs a pending task and persists its result", async () => {
    const deps = makeDeps()
    const task = await pendingTask(deps)

    await runTask(deps, task.id, async () => ({ pages: 2 }))

    const stored = await deps.repos.tasks.getById(task.id)
    expect(stored).toMatchObject({
      status: "SUCCEEDED",
      resultJson: { pages: 2 },
      error: null,
    })
    expect(stored?.startedAt).toBeInstanceOf(Date)
    expect(stored?.finishedAt).toBeInstanceOf(Date)
  })

  it("persists a thrown error", async () => {
    const deps = makeDeps()
    const task = await pendingTask(deps)

    await runTask(deps, task.id, async () => {
      throw new Error("generation failed")
    })

    const stored = await deps.repos.tasks.getById(task.id)
    expect(stored).toMatchObject({
      status: "FAILED",
      error: "generation failed",
    })
    expect(stored?.startedAt).toBeInstanceOf(Date)
    expect(stored?.finishedAt).toBeInstanceOf(Date)
  })

  it("does not run a task which is already running", async () => {
    const deps = makeDeps()
    const task = await pendingTask(deps)
    await deps.repos.tasks.update(task.id, { status: "RUNNING" })
    const handler = vi.fn()

    await runTask(deps, task.id, handler)

    expect(handler).not.toHaveBeenCalled()
  })

  it("atomically claims a task across duplicate deliveries", async () => {
    const deps = makeDeps()
    const task = await pendingTask(deps)
    const handler = vi.fn(async () => ({ done: true }))

    await Promise.all([
      runTask(deps, task.id, handler),
      runTask(deps, task.id, handler),
    ])

    expect(handler).toHaveBeenCalledOnce()
  })
})
