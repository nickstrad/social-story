import { describe, expect, it } from "vitest"

import { validateAuthInput } from "@/lib/validation/auth"

const valid = { name: "Alex", email: "alex@example.com", password: "password1" }

describe("validateAuthInput", () => {
  it("rejects an invalid email", () => {
    expect(
      validateAuthInput({ ...valid, email: "nope" }, "signin").email
    ).toBeTruthy()
  })

  it("rejects a short password", () => {
    expect(
      validateAuthInput({ ...valid, password: "short" }, "signup").password
    ).toBeTruthy()
  })

  it("accepts valid sign-up input", () => {
    expect(validateAuthInput(valid, "signup")).toEqual({})
  })
})
