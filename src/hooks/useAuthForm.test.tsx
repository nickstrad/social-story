import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useAuthForm } from "@/hooks/useAuthForm"

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}))

vi.mock("@/lib/auth-client", () => ({
  signIn: { email: mocks.signInEmail },
  signUp: { email: mocks.signUpEmail },
}))

describe("useAuthForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.signInEmail.mockResolvedValue({ data: {}, error: null })
  })

  it("submits valid credentials and redirects", async () => {
    const { result } = renderHook(() => useAuthForm("signin"))

    act(() => {
      result.current.onChange("email", "alex@example.com")
      result.current.onChange("password", "password1")
    })
    await act(() => result.current.onSubmit())

    expect(mocks.signInEmail).toHaveBeenCalledWith({
      email: "alex@example.com",
      password: "password1",
    })
    expect(mocks.push).toHaveBeenCalledWith("/stories")
  })

  it("sets errors without calling the client for invalid input", async () => {
    const { result } = renderHook(() => useAuthForm("signin"))

    act(() => result.current.onChange("email", "invalid"))
    await act(() => result.current.onSubmit())

    expect(result.current.errors.email).toBeTruthy()
    expect(result.current.errors.password).toBeTruthy()
    expect(mocks.signInEmail).not.toHaveBeenCalled()
  })
})
