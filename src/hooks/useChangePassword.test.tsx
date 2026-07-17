import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useChangePassword } from "@/hooks/useChangePassword"

const mocks = vi.hoisted(() => ({
  changePassword: vi.fn(),
}))

vi.mock("@/lib/auth-client", () => ({
  changePassword: mocks.changePassword,
}))

const valid = {
  currentPassword: "Password123!",
  newPassword: "NewPassword456!",
  confirmPassword: "NewPassword456!",
}

function fillValidForm(result: {
  current: ReturnType<typeof useChangePassword>
}) {
  act(() => {
    result.current.onChange("currentPassword", valid.currentPassword)
    result.current.onChange("newPassword", valid.newPassword)
    result.current.onChange("confirmPassword", valid.confirmPassword)
  })
}

describe("useChangePassword", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.changePassword.mockResolvedValue({ data: {}, error: null })
  })

  it("submits through Better Auth, clears the form, and hides passwords", async () => {
    const { result } = renderHook(useChangePassword)
    fillValidForm(result)
    act(() => result.current.toggleVisibility("newPassword"))

    await act(() => result.current.onSubmit())

    expect(mocks.changePassword).toHaveBeenCalledWith({
      currentPassword: valid.currentPassword,
      newPassword: valid.newPassword,
      revokeOtherSessions: true,
    })
    expect(result.current.values).toEqual({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    })
    expect(result.current.visibility).toEqual({
      currentPassword: false,
      newPassword: false,
      confirmPassword: false,
    })
    expect(result.current.isSuccess).toBe(true)
  })

  it("rejects invalid input without calling Better Auth", async () => {
    const { result } = renderHook(useChangePassword)

    act(() => {
      result.current.onChange("currentPassword", valid.currentPassword)
      result.current.onChange("newPassword", valid.newPassword)
      result.current.onChange("confirmPassword", "DifferentPassword789!")
    })
    await act(() => result.current.onSubmit())

    expect(result.current.errors.confirmPassword).toBe("Passwords do not match")
    expect(mocks.changePassword).not.toHaveBeenCalled()
  })

  it("maps an invalid provider password to the current-password field", async () => {
    mocks.changePassword.mockResolvedValue({
      data: null,
      error: {
        message: "Invalid password",
        error: { code: "INVALID_PASSWORD" },
      },
    })
    const { result } = renderHook(useChangePassword)
    fillValidForm(result)

    await act(() => result.current.onSubmit())

    expect(result.current.errors).toEqual({
      currentPassword: "Current password is incorrect",
    })
    expect(result.current.isSuccess).toBe(false)
  })

  it("exposes the pending state until the request settles", async () => {
    let resolveRequest!: (value: { data: object; error: null }) => void
    mocks.changePassword.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve
      })
    )
    const { result } = renderHook(useChangePassword)
    fillValidForm(result)

    let submission!: Promise<void>
    act(() => {
      submission = result.current.onSubmit()
    })
    expect(result.current.isSubmitting).toBe(true)

    await act(async () => {
      resolveRequest({ data: {}, error: null })
      await submission
    })
    expect(result.current.isSubmitting).toBe(false)
  })

  it("shows a connection error and recovers from a rejected request", async () => {
    mocks.changePassword.mockRejectedValue(new Error("network unavailable"))
    const { result } = renderHook(useChangePassword)
    fillValidForm(result)

    await act(() => result.current.onSubmit())

    expect(result.current.errors.form).toBe(
      "Unable to connect. Check your connection and try again."
    )
    expect(result.current.isSubmitting).toBe(false)
  })
})
