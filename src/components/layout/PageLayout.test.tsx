import { expect, test } from "vitest"
import { render, screen } from "@testing-library/react"

import { PageLayout, pageLayoutVariants } from "@/components/layout/PageLayout"

test("defaults to the content width and the standard page stack", () => {
  render(<PageLayout data-testid="frame">content</PageLayout>)

  const frame = screen.getByTestId("frame")
  expect(frame).toHaveClass("max-w-content")
  expect(frame).toHaveClass("gap-page")
})

test.each([
  ["form", "max-w-form"],
  ["content", "max-w-content"],
  ["app", "max-w-app"],
] as const)("width=%s maps to %s", (width, expected) => {
  render(
    <PageLayout data-testid="frame" width={width}>
      content
    </PageLayout>
  )

  expect(screen.getByTestId("frame")).toHaveClass(expected)
})

test.each([
  ["standard", "gap-page"],
  ["relaxed", "gap-page-relaxed"],
] as const)("spacing=%s maps to %s", (spacing, expected) => {
  render(
    <PageLayout data-testid="frame" spacing={spacing}>
      content
    </PageLayout>
  )

  expect(screen.getByTestId("frame")).toHaveClass(expected)
})

test("a caller-provided className wins over the variant it conflicts with", () => {
  render(
    <PageLayout data-testid="frame" width="app" className="max-w-form">
      content
    </PageLayout>
  )

  const frame = screen.getByTestId("frame")
  expect(frame).toHaveClass("max-w-form")
  expect(frame).not.toHaveClass("max-w-app")
})

test("passes DOM props through to the underlying element", () => {
  render(
    <PageLayout id="page-frame" aria-label="Frame">
      content
    </PageLayout>
  )

  expect(screen.getByLabelText("Frame")).toHaveAttribute("id", "page-frame")
})

test("pageLayoutVariants is usable by non-div consumers", () => {
  const className = pageLayoutVariants({ width: "form", spacing: "relaxed" })

  expect(className).toContain("max-w-form")
  expect(className).toContain("gap-page-relaxed")
})
