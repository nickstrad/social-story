"use client"

import type { MouseEvent } from "react"
import { useRouter } from "next/navigation"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type SortingState,
} from "@tanstack/react-table"
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ListSort } from "@/lib/validation/listParams"

export function DataTable<T, Field extends string>({
  columns,
  data,
  sort,
  onSortChange,
  getRowHref,
  emptyTitle = "Nothing here yet",
  emptyDescription,
}: {
  columns: ColumnDef<T>[]
  data: T[]
  sort: ListSort<Field>
  onSortChange: (sort: ListSort<Field>) => void
  getRowHref?: (row: T) => string
  emptyTitle?: string
  emptyDescription?: string
}) {
  const router = useRouter()
  const sorting: SortingState = [{ id: sort.field, desc: sort.dir === "desc" }]
  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === "function" ? updater(sorting) : updater
    const first = next[0]
    if (first) {
      onSortChange({
        field: first.id as Field,
        dir: first.desc ? "desc" : "asc",
      })
    }
  }
  // TanStack Table intentionally returns stateful callbacks that the React
  // Compiler cannot memoize; the table owns that state integration itself.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns,
    data,
    state: { sorting },
    manualSorting: true,
    enableSortingRemoval: false,
    onSortingChange: handleSortingChange,
    getCoreRowModel: getCoreRowModel(),
  })
  const navigateRow = (event: MouseEvent<HTMLTableRowElement>, row: T) => {
    if (!getRowHref) return
    if ((event.target as HTMLElement).closest("a, button")) return
    router.push(getRowHref(row))
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sorted = header.column.getIsSorted()
                const SortIcon =
                  sorted === "asc"
                    ? ArrowUpIcon
                    : sorted === "desc"
                      ? ArrowDownIcon
                      : ArrowUpDownIcon
                return (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <Button
                        variant="ghost"
                        className="-ml-2"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        <SortIcon />
                      </Button>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className={getRowHref ? "cursor-pointer" : undefined}
                onClick={(event) => navigateRow(event, row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="p-0">
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>{emptyTitle}</EmptyTitle>
                    {emptyDescription && (
                      <EmptyDescription>{emptyDescription}</EmptyDescription>
                    )}
                  </EmptyHeader>
                </Empty>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export function DataTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div
      data-slot="data-table-skeleton"
      className="grid overflow-hidden rounded-lg border"
    >
      <Skeleton className="h-10 rounded-none" />
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-12 rounded-none border-t" />
      ))}
    </div>
  )
}
