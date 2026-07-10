import { describe, expect, it } from "vitest"

import { task } from "@/server/domain/testFactories"
import { summarizePageProgress } from "./useBulkGeneration"

describe("summarizePageProgress", () => {
  it("counts only PAGE_IMAGE tasks, ignoring other task types", () => {
    const tasks = [
      task("PENDING", { type: "PAGE_IMAGE" }),
      task("RUNNING", { type: "PAGE_IMAGE" }),
      task("SUCCEEDED", { type: "PAGE_IMAGE" }),
      task("RUNNING", { type: "BASE_IMAGE" }),
      task("PENDING", { type: "PARSE_STORY" }),
    ]
    expect(summarizePageProgress(tasks)).toEqual({
      pending: 1,
      running: 1,
      failed: 0,
      done: 1,
    })
  })

  it("is all zeroes when there are no page-image tasks", () => {
    expect(
      summarizePageProgress([task("RUNNING", { type: "BASE_IMAGE" })])
    ).toEqual({ pending: 0, running: 0, failed: 0, done: 0 })
  })
})
