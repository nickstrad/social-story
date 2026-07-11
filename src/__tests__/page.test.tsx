import { expect, test, vi } from "vitest"
import { render, screen } from "@testing-library/react"

const { getServerSessionMock } = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
}))

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}))

vi.mock("@/server/auth-session", () => ({
  getServerSession: getServerSessionMock,
}))

import Home from "@/app/page"

test("signed-out home page shows the landing hero and auth CTAs", async () => {
  getServerSessionMock.mockResolvedValue(null)
  render(await Home())

  expect(
    screen.getByRole("heading", {
      name: "Personalized social stories, made in minutes",
    })
  ).toBeInTheDocument()
  // Both the navbar and the hero surface these CTAs.
  expect(
    screen.getAllByRole("link", { name: "Get started" }).length
  ).toBeGreaterThan(0)
  expect(
    screen.getAllByRole("link", { name: "Sign in" }).length
  ).toBeGreaterThan(0)
})

test("signed-in home page links into the app", async () => {
  getServerSessionMock.mockResolvedValue({
    user: { email: "user@example.com" },
  })
  render(await Home())

  expect(
    screen.getByRole("link", { name: "Go to your stories" })
  ).toBeInTheDocument()
})
