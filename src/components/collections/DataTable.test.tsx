import { render, screen } from "@testing-library/react"
import type { ColumnDef } from "@tanstack/react-table"
import { describe, expect, it, vi } from "vitest"

import { DataTable } from "./DataTable"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))

type Row = { id: string; name: string }
const columns: ColumnDef<Row>[] = [
  { accessorKey: "name", header: "Name", enableSorting: true },
]

describe("DataTable", () => {
  it("reports manual sort changes", () => {
    const onSortChange = vi.fn()
    render(
      <DataTable
        columns={columns}
        data={[{ id: "1", name: "Ada" }]}
        sort={{ field: "name", dir: "asc" }}
        onSortChange={onSortChange}
      />
    )
    screen.getByRole("button", { name: /Name/ }).click()
    expect(onSortChange).toHaveBeenCalledWith({ field: "name", dir: "desc" })
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
