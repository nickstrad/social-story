import { describe, expect, it } from "vitest"

import { taskEventFor } from "./events"
import { taskWorkflows } from "./workflows"

describe("task workflows", () => {
  it("gives every task a descriptive function and event name", () => {
    expect(
      Object.values(taskWorkflows).map((workflow) => workflow.functionName)
    ).toEqual([
      "Convert story to pages",
      "Generate character reference sheet",
      "Generate page illustration",
      "Build story PDF",
    ])
    expect(taskEventFor("PARSE_STORY").name).toBe(
      "story/convert-to-pages.requested"
    )
    expect(taskEventFor("PAGE_IMAGE").name).toBe(
      "story/generate-page-illustration.requested"
    )
  })
})
