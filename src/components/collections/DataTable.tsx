"use client"

import { useState, type MouseEvent } from "react"
import { useRouter } from "next/navigation"
import {
  flexRender,
  functionalUpdate,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
  type Table as TableInstance,
} from "@tanstack/react-table"
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ListSort } from "@/lib/validation/listParams"

const PAGE_SIZE_OPTIONS = [10, 20] as const
const DEFAULT_PAGINATION: PaginationState = { pageIndex: 0, pageSize: 20 }

interface NextPage {
  hasNext: boolean
  isFetching: boolean
  fetch: () => Promise<unknown>
}

interface DataTableProps<T, Field extends string> {
  columns: ColumnDef<T>[]
  data: T[]
  sort: ListSort<Field>
  onSortChange: (sort: ListSort<Field>) => void
  getRowHref?: (row: T) => string
  nextPage?: NextPage
  emptyTitle?: string
  emptyDescription?: string
}

export function DataTable<T, Field extends string>({
  columns,
  data,
  sort,
  onSortChange,
  getRowHref,
  nextPage,
  emptyTitle = "Nothing here yet",
  emptyDescription,
}: DataTableProps<T, Field>) {
  const router = useRouter()
  const [pagination, setPagination] =
    useState<PaginationState>(DEFAULT_PAGINATION)
  const sorting: SortingState = [{ id: sort.field, desc: sort.dir === "desc" }]
  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = functionalUpdate(updater, sorting)
    const first = next[0]
    if (!first) return
    setPagination((current) => ({ ...current, pageIndex: 0 }))
    onSortChange({
      field: first.id as Field,
      dir: first.desc ? "desc" : "asc",
    })
  }
  // TanStack Table intentionally returns stateful callbacks that the React
  // Compiler cannot memoize; the table owns that state integration itself.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns,
    data,
    state: { pagination, sorting },
    autoResetPageIndex: false,
    manualSorting: true,
    enableSortingRemoval: false,
    onPaginationChange: setPagination,
    onSortingChange: handleSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
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
      {data.length > 0 && (
        <DataTablePagination table={table} nextPage={nextPage} />
      )}
    </div>
  )
}

function DataTablePagination<T>({
  table,
  nextPage,
}: {
  table: TableInstance<T>
  nextPage?: NextPage
}) {
  const { pageIndex, pageSize } = table.getState().pagination
  const canGoNext = table.getCanNextPage() || Boolean(nextPage?.hasNext)
  const goToNextPage = async () => {
    if (table.getCanNextPage()) {
      table.nextPage()
      return
    }
    if (!nextPage?.hasNext) return
    await nextPage.fetch()
    table.setPageIndex((current) => current + 1)
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-3 py-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Rows per page</span>
        <Select
          value={String(pageSize)}
          onValueChange={(value) =>
            table.setPagination({ pageIndex: 0, pageSize: Number(value) })
          }
        >
          <SelectTrigger size="sm" aria-label="Rows per page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <span className="text-sm text-muted-foreground">
        Page {pageIndex + 1}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.previousPage()}
        >
          <ChevronLeftIcon />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!canGoNext || nextPage?.isFetching}
          onClick={() => void goToNextPage()}
        >
          Next
          <ChevronRightIcon />
        </Button>
      </div>
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
