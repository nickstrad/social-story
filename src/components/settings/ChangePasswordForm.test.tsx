import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ChangePasswordForm } from "@/components/settings/ChangePasswordForm"

const mocks = vi.hoisted(() => ({
  changePassword: vi.fn(),
}))

vi.mock("@/lib/auth-client", () => ({
  changePassword: mocks.changePassword,
}))

describe("ChangePasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.changePassword.mockResolvedValue({ data: {}, error: null })
  })

  it("uses password autocomplete and accessible visibility controls", () => {
    render(<ChangePasswordForm />)

    const currentPassword = screen.getByLabelText("Current password")
    const newPassword = screen.getByLabelText("New password")
    const confirmation = screen.getByLabelText("Confirm new password")

    expect(currentPassword).toHaveAttribute("autocomplete", "current-password")
    expect(newPassword).toHaveAttribute("autocomplete", "new-password")
    expect(confirmation).toHaveAttribute("autocomplete", "new-password")
    expect(currentPassword).toHaveAttribute("type", "password")

    fireEvent.click(
      screen.getByRole("button", { name: "Show current password" })
    )
    expect(currentPassword).toHaveAttribute("type", "text")
    expect(
      screen.getByRole("button", { name: "Hide current password" })
    ).toHaveAttribute("aria-pressed", "true")
  })

  it("shows local confirmation errors beside the field", async () => {
    render(<ChangePasswordForm />)

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "Password123!" },
    })
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "NewPassword456!" },
    })
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "DifferentPassword789!" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Update password" }))

    expect(await screen.findByText("Passwords do not match")).toBeVisible()
    expect(mocks.changePassword).not.toHaveBeenCalled()
  })
})
