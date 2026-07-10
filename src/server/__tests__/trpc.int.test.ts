// @vitest-environment node

import { describe, expect, it } from "vitest"

import { createTestCaller } from "@/server/api/test-utils"

const user = {
  id: "user-1",
  name: "Test User",
  email: "test@example.com",
  emailVerified: true,
  image: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
}

describe("tRPC caller", () => {
  it("rejects a protected procedure without a session", async () => {
    await expect(createTestCaller().me()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    })
  })

  it("returns the signed-in user from a protected procedure", async () => {
    await expect(createTestCaller({ user }).me()).resolves.toEqual(user)
  })
})
