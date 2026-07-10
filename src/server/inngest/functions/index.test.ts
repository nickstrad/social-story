// @vitest-environment node

import { describe, expect, it } from "vitest"

import type { Deps } from "@/server/container"
import { inMemoryRepos } from "@/server/repos/memory"
import {
  fakeImageGenerator,
  fakeTextGenerator,
  immediateDispatcher,
} from "@/server/services/fakes"
import { inMemoryStorage } from "@/server/services/memory-storage"

import { dispatchTask } from "./index"

function makeDeps(): Deps {
  return {
    repos: inMemoryRepos(),
    storage: inMemoryStorage(),
    text: fakeTextGenerator({}),
    image: fakeImageGenerator(),
    dispatcher: immediateDispatcher(async () => {}),
  }
}

describe("dispatchTask", () => {
  it("fails a task when its type has no registered handler", async () => {
    const deps = makeDeps()
    const task = await deps.repos.tasks.create({
      userId: "user-1",
      storyId: "story-1",
      type: "PDF_EXPORT",
    })

    await dispatchTask(deps, task.id)

    expect(await deps.repos.tasks.getById(task.id)).toMatchObject({
      status: "FAILED",
      error: "No handler registered for PDF_EXPORT",
    })
  })
})
