import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AppHeader } from "@/components/layout/AppHeader"
import { SidebarProvider } from "@/components/ui/sidebar"

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }))

function renderHeader(props: React.ComponentProps<typeof AppHeader>) {
  return render(
    <SidebarProvider>
      <AppHeader {...props} />
    </SidebarProvider>
  )
}

describe("AppHeader", () => {
  it("opens an account menu with the email and account actions", async () => {
    const onSignOut = vi.fn()
    renderHeader({
      email: "alex@example.com",
      isSigningOut: false,
      onSignOut,
    })

    fireEvent.click(screen.getByRole("button", { name: "Open account menu" }))

    expect(await screen.findByText("alex@example.com")).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings"
    )

    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }))
    expect(onSignOut).toHaveBeenCalledOnce()
  })

  it("disables the account trigger while signing out", () => {
    renderHeader({
      email: "alex@example.com",
      isSigningOut: true,
      onSignOut: vi.fn(),
    })

    expect(
      screen.getByRole("button", { name: "Open account menu" })
    ).toBeDisabled()
  })
})
