import { describe, expect, it } from "vitest"
import { deriveParseState } from "./parseState"
import { task } from "@/server/domain/testFactories"

describe("deriveParseState", () => {
  const draft = { status: "DRAFT" as const, pageCount: 0 }

  it("is idle without a task on a draft story", () => {
    expect(deriveParseState(undefined, draft)).toEqual({ state: "idle" })
  })

  it("is parsing while the task runs", () => {
    expect(deriveParseState(task("RUNNING"), draft).state).toBe("parsing")
    expect(deriveParseState(task("PENDING"), draft).state).toBe("parsing")
  })

  it("surfaces the task error on failure", () => {
    expect(deriveParseState(task("FAILED", { error: "boom" }), draft)).toEqual({
      state: "error",
      error: "boom",
    })
  })

  it("reports the page count from a succeeded task", () => {
    expect(
      deriveParseState(
        task("SUCCEEDED", { resultJson: { pageCount: 21 } }),
        draft
      )
    ).toEqual({ state: "done", pageCount: 21 })
  })

  it("falls back to the story page count when the task lacks one", () => {
    expect(
      deriveParseState(task("SUCCEEDED"), {
        status: "PARSED",
        pageCount: 18,
      })
    ).toEqual({ state: "done", pageCount: 18 })
  })

  it("reads done from a parsed story with no task after reload", () => {
    expect(
      deriveParseState(undefined, { status: "PARSED", pageCount: 20 })
    ).toEqual({ state: "done", pageCount: 20 })
  })
})
