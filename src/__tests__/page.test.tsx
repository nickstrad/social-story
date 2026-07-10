import { expect, test } from "vitest"
import { render, screen } from "@testing-library/react"
import Home from "@/app/page"

test("renders the home page heading", () => {
  render(<Home />)
  expect(
    screen.getByText("To get started, edit the page.tsx file.")
  ).toBeInTheDocument()
})
