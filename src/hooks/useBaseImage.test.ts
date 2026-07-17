import { describe, expect, it } from "vitest"

import { canGenerateBase, latestBaseImageTask } from "./useBaseImage"
import { character, task } from "@/server/domain/testFactories"
import type { ClientStory, Task } from "@/server/domain/types"

function baseTask(id: string, createdAt: string): Task {
  return {
    ...task("PENDING"),
    id,
    type: "BASE_IMAGE",
    createdAt: new Date(createdAt),
  }
}

const story: ClientStory = {
  id: "story",
  userId: "user",
  title: "A Story",
  script: "script",
  status: "DRAFT",
  baseImageUrl: null,
  baseImageAssetId: null,
  coverNote: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
}

describe("canGenerateBase", () => {
  it("is false without a story", () => {
    expect(canGenerateBase(undefined, [character("a")], undefined)).toBe(false)
  })

  it("is false with no characters", () => {
    expect(canGenerateBase(story, [], undefined)).toBe(false)
  })

  it.each(["PENDING", "RUNNING"] as const)(
    "is false while a %s task runs",
    (status) => {
      expect(canGenerateBase(story, [character("a")], task(status))).toBe(false)
    }
  )

  it("is true with characters and no active task", () => {
    expect(canGenerateBase(story, [character("a")], undefined)).toBe(true)
  })

  it.each(["SUCCEEDED", "FAILED"] as const)(
    "is true after a %s task finishes",
    (status) => {
      expect(canGenerateBase(story, [character("a")], task(status))).toBe(true)
    }
  )
})

describe("latestBaseImageTask", () => {
  it("returns undefined when there are no base-image tasks", () => {
    expect(latestBaseImageTask([task("PENDING")])).toBeUndefined()
  })

  it("ignores tasks of other types", () => {
    const pageTask = { ...task("RUNNING"), type: "PAGE_IMAGE" as const }
    expect(latestBaseImageTask([pageTask])).toBeUndefined()
  })

  it("returns the most recently created base-image task", () => {
    const older = baseTask("older", "2026-01-01T00:00:00Z")
    const newer = baseTask("newer", "2026-01-02T00:00:00Z")
    expect(latestBaseImageTask([older, newer])?.id).toBe("newer")
    expect(latestBaseImageTask([newer, older])?.id).toBe("newer")
  })
})
