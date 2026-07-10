import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useSignOut } from "@/hooks/useSignOut"

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  signOut: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}))

vi.mock("@/lib/auth-client", () => ({ signOut: mocks.signOut }))
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }))

describe("useSignOut", () => {
  beforeEach(() => vi.clearAllMocks())

  it("recovers when the sign-out request fails", async () => {
    mocks.signOut.mockRejectedValue(new Error("network unavailable"))
    const { result } = renderHook(useSignOut)

    await act(() => result.current.handleSignOut())

    expect(result.current.isSigningOut).toBe(false)
    expect(mocks.push).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Unable to sign out. Please try again."
    )
  })
})
