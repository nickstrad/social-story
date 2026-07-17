import { describe, expect, it } from "vitest"

import { validateAuthInput } from "@/lib/validation/auth"

const valid = {
  name: "Alex",
  email: "alex@example.com",
  password: "password1",
  confirmPassword: "password1",
}

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

  it("rejects a password longer than the provider maximum", () => {
    expect(
      validateAuthInput({ ...valid, password: "a".repeat(129) }, "signup")
        .password
    ).toBeTruthy()
  })

  it("rejects a mismatched confirmation on sign-up", () => {
    expect(
      validateAuthInput({ ...valid, confirmPassword: "different1" }, "signup")
        .confirmPassword
    ).toBeTruthy()
  })

  it("ignores the confirmation on sign-in", () => {
    expect(
      validateAuthInput({ ...valid, confirmPassword: "" }, "signin")
    ).toEqual({})
  })

  it("accepts valid sign-up input", () => {
    expect(validateAuthInput(valid, "signup")).toEqual({})
  })
})
