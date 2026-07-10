// @vitest-environment node

import { describe, expect, it } from "vitest"
import { canTransition, nextVariant, summarizeStoryTasks } from "./taskMachine"
import { task } from "./testFactories"
import type { TaskStatus } from "./types"

describe("task state machine", () => {
  it("enforces the full transition matrix", () => {
    const statuses: TaskStatus[] = ["PENDING", "RUNNING", "SUCCEEDED", "FAILED"]
    const allowed = new Set([
      "PENDING>RUNNING",
      "PENDING>FAILED",
      "RUNNING>SUCCEEDED",
      "RUNNING>FAILED",
    ])
    for (const from of statuses)
      for (const to of statuses)
        expect(canTransition(from, to)).toBe(allowed.has(`${from}>${to}`))
  })

  it("chooses one above the maximum variant", () => {
    expect(nextVariant([1, 3])).toBe(4)
    expect(nextVariant([])).toBe(1)
  })

  it("summarizes task statuses for badges", () => {
    expect(
      summarizeStoryTasks([
        task("PENDING"),
        task("RUNNING"),
        task("FAILED"),
        task("SUCCEEDED"),
        task("SUCCEEDED"),
      ])
    ).toEqual({ pending: 1, running: 1, failed: 1, done: 2 })
  })
})
