import { expect, test } from "vitest"
import { render, screen } from "@testing-library/react"

import { PageHeader } from "@/components/layout/PageHeader"

test("renders an h1 with the page-title scale by default", () => {
  render(<PageHeader title="Stories" />)

  const heading = screen.getByRole("heading", { level: 1, name: "Stories" })
  expect(heading).toHaveClass("text-page-title")
  expect(heading).toHaveClass("font-heading")
})

test("size=section derives an h2 with the section-title scale", () => {
  render(<PageHeader size="section" title="Visual rules" />)

  const heading = screen.getByRole("heading", {
    level: 2,
    name: "Visual rules",
  })
  expect(heading).toHaveClass("text-section-title")
})

test("an explicit level overrides the size-derived heading level", () => {
  render(<PageHeader size="page" level={2} title="Pages" />)

  const heading = screen.getByRole("heading", { level: 2, name: "Pages" })
  // The level moves, but the type scale still follows `size`.
  expect(heading).toHaveClass("text-page-title")
})

test("renders the description in the muted foreground when given", () => {
  render(<PageHeader title="Export" description="Download a PDF." />)

  expect(screen.getByText("Download a PDF.")).toHaveClass(
    "text-muted-foreground"
  )
})

test("omits the description element entirely when not given", () => {
  const { container } = render(<PageHeader title="Export" />)

  expect(container.querySelector("p")).toBeNull()
})

test("renders actions alongside the title", () => {
  render(<PageHeader title="Stories" actions={<button>New story</button>} />)

  expect(screen.getByRole("button", { name: "New story" })).toBeInTheDocument()
})

test("merges a caller-provided className onto the header", () => {
  render(<PageHeader data-testid="header" title="Stories" className="pb-8" />)

  expect(screen.getByTestId("header")).toHaveClass("pb-8")
})
