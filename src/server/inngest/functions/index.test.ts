// @vitest-environment node

import { describe, expect, it } from "vitest"

import { createFakeAiActions } from "@/server/ai/testing/fakes"
import type { Deps } from "@/server/container"
import type { TaskType } from "@/server/domain/types"
import { inMemoryRepos } from "@/server/repos/memory"
import { immediateDispatcher } from "@/server/services/fakes"
import { inMemoryStorage } from "@/server/services/memory-storage"

import { dispatchTask } from "./index"

function makeDeps(): Deps {
  return {
    repos: inMemoryRepos(),
    storage: inMemoryStorage(),
    ai: createFakeAiActions(),
    dispatcher: immediateDispatcher(async () => {}),
  }
}

describe("dispatchTask", () => {
  it("fails a task when its type has no registered handler", async () => {
    const deps = makeDeps()
    // Every real TaskType now has a registered handler, so use an unknown type
    // to exercise the missing-handler path.
    const task = await deps.repos.tasks.create({
      userId: "user-1",
      storyId: "story-1",
      type: "UNKNOWN_TYPE" as TaskType,
    })

    await dispatchTask(deps, task.id)

    expect(await deps.repos.tasks.getById(task.id)).toMatchObject({
      status: "FAILED",
      error: "No handler registered for UNKNOWN_TYPE",
    })
  })
})
