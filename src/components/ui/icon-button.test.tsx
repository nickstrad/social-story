import { fireEvent, render, screen } from "@testing-library/react"
import { PencilIcon } from "lucide-react"
import { describe, expect, it } from "vitest"

import { IconButton } from "./icon-button"
import { TooltipProvider } from "./tooltip"

describe("IconButton", () => {
  it("uses its label for the accessible name and tooltip", async () => {
    render(
      <TooltipProvider>
        <IconButton label="Edit character">
          <PencilIcon />
        </IconButton>
      </TooltipProvider>
    )
    const button = screen.getByRole("button", { name: "Edit character" })
    fireEvent.mouseEnter(button)
    expect(await screen.findByText("Edit character")).toBeVisible()
  })
})
