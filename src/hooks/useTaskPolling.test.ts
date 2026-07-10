import { describe, expect, it } from "vitest"

import { pollInterval } from "./useTaskPolling"

describe("pollInterval", () => {
  it.each(["PENDING", "RUNNING"] as const)("polls for %s", (status) => {
    expect(pollInterval(status)).toBe(1500)
  })

  it.each(["SUCCEEDED", "FAILED"] as const)(
    "stops polling for %s",
    (status) => {
      expect(pollInterval(status)).toBe(false)
    }
  )

  it("does not poll before data arrives", () => {
    expect(pollInterval(undefined)).toBe(false)
  })
})
