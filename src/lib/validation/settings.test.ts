import { describe, expect, it } from "vitest"

import { validateChangePasswordInput } from "@/lib/validation/settings"

const valid = {
  currentPassword: "Password123!",
  newPassword: "NewPassword456!",
  confirmPassword: "NewPassword456!",
}

describe("validateChangePasswordInput", () => {
  it("requires every password field", () => {
    expect(
      validateChangePasswordInput({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })
    ).toMatchObject({
      currentPassword: "Enter your current password",
      newPassword: "Password must be at least 8 characters",
      confirmPassword: "Confirm your new password",
    })
  })

  it("enforces the provider password length boundaries", () => {
    expect(
      validateChangePasswordInput({
        ...valid,
        newPassword: "short",
        confirmPassword: "short",
      }).newPassword
    ).toBe("Password must be at least 8 characters")

    const tooLong = "a".repeat(129)
    expect(
      validateChangePasswordInput({
        ...valid,
        newPassword: tooLong,
        confirmPassword: tooLong,
      }).newPassword
    ).toBe("Password must be at most 128 characters")
  })

  it("rejects a mismatched confirmation", () => {
    expect(
      validateChangePasswordInput({
        ...valid,
        confirmPassword: "DifferentPassword789!",
      }).confirmPassword
    ).toBe("Passwords do not match")
  })

  it("rejects reusing the current password", () => {
    expect(
      validateChangePasswordInput({
        ...valid,
        newPassword: valid.currentPassword,
        confirmPassword: valid.currentPassword,
      }).newPassword
    ).toBe("Choose a password different from your current password")
  })

  it("accepts a valid password change", () => {
    expect(validateChangePasswordInput(valid)).toEqual({})
  })
})
