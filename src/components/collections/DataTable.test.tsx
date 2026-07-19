import { fireEvent, render, screen } from "@testing-library/react"
import type { ColumnDef } from "@tanstack/react-table"
import { describe, expect, it, vi } from "vitest"

import { DataTable } from "./DataTable"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))

type Row = { id: string; name: string }
const columns: ColumnDef<Row>[] = [
  { accessorKey: "name", header: "Name", enableSorting: true },
]
const rows = (count: number): Row[] =>
  Array.from({ length: count }, (_, index) => ({
    id: String(index + 1),
    name: `Row ${index + 1}`,
  }))

describe("DataTable", () => {
  it("reports server sort changes and returns to page 1", () => {
    const onSortChange = vi.fn()
    render(
      <DataTable
        columns={columns}
        data={rows(41)}
        sort={{ field: "name", dir: "asc" }}
        onSortChange={onSortChange}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /Next/ }))
    fireEvent.click(screen.getByRole("button", { name: /Next/ }))
    expect(screen.getByText("Page 3")).toBeVisible()

    fireEvent.click(screen.getByRole("button", { name: /Name/ }))
    expect(onSortChange).toHaveBeenCalledWith({ field: "name", dir: "desc" })
    expect(screen.getByText("Page 1")).toBeVisible()
  })

  it("shows 20 rows per page by default", () => {
    render(
      <DataTable
        columns={columns}
        data={rows(21)}
        sort={{ field: "name", dir: "asc" }}
        onSortChange={() => undefined}
      />
    )

    expect(screen.getByText("Page 1")).toBeVisible()
    expect(screen.getByText("Row 20")).toBeVisible()
    expect(screen.queryByText("Row 21")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Next/ }))
    expect(screen.getByText("Page 2")).toBeVisible()
    expect(screen.getByText("Row 21")).toBeVisible()
  })

  it("renders an empty state", () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        sort={{ field: "name", dir: "asc" }}
        onSortChange={() => undefined}
        emptyTitle="No rows"
      />
    )
    expect(screen.getByText("No rows")).toBeVisible()
  })
})
