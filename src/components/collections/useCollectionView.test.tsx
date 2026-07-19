import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { useCollectionView } from "./useCollectionView"
import { CollectionViewSkeleton } from "./CollectionViewSkeleton"

function Harness() {
  const [view, setView] = useCollectionView("test-screen")
  return (
    <button onClick={() => setView(view === "grid" ? "table" : "grid")}>
      {view}
    </button>
  )
}

describe("useCollectionView", () => {
  it("persists the view per screen", async () => {
    localStorage.setItem("collection-view:test-screen", "table")
    const { unmount } = render(<Harness />)
    expect(screen.getByRole("button")).toHaveTextContent("table")
    screen.getByRole("button").click()
    expect(localStorage.getItem("collection-view:test-screen")).toBe("grid")
    unmount()

    render(<Harness />)
    expect(screen.getByRole("button")).toHaveTextContent("grid")
  })

  it("selects the table skeleton for a persisted table view", () => {
    localStorage.setItem("collection-view:skeleton-test", "table")
    const { container } = render(
      <CollectionViewSkeleton screenKey="skeleton-test" rows={2}>
        <div>Grid skeleton</div>
      </CollectionViewSkeleton>
    )
    expect(screen.queryByText("Grid skeleton")).not.toBeInTheDocument()
    expect(
      container.querySelector('[data-slot="data-table-skeleton"]')
    ).toBeInTheDocument()
  })
})
