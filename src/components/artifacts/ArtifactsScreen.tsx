"use client"

import Image from "next/image"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { useMemo, useState } from "react"
import { FileTextIcon } from "lucide-react"

import { ArtifactGrid, artifactHref, kindLabels } from "./ArtifactGrid"
import { DataTable } from "@/components/collections/DataTable"
import { formatCollectionDate } from "@/components/collections/formatDate"
import { LoadMoreButton } from "@/components/collections/LoadMoreButton"
import {
  SortSelect,
  type SortOption,
} from "@/components/collections/SortSelect"
import { useCollectionView } from "@/components/collections/useCollectionView"
import { ViewToggle } from "@/components/collections/ViewToggle"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/layout/PageHeader"
import { PageLayout } from "@/components/layout/PageLayout"
import { trpc } from "@/lib/trpc"
import {
  type ArtifactSortField,
  type ListSort,
} from "@/lib/validation/listParams"
import type { Artifact } from "@/server/domain/artifacts"

const sortOptions: SortOption<ArtifactSortField>[] = [
  { label: "Newest", sort: { field: "createdAt", dir: "desc" } },
  { label: "Oldest", sort: { field: "createdAt", dir: "asc" } },
]

function ArtifactThumb({ artifact }: { artifact: Artifact }) {
  return (
    <div className="relative grid size-12 place-items-center overflow-hidden rounded-md bg-muted text-muted-foreground">
      {artifact.kind === "PDF" ? (
        <FileTextIcon />
      ) : (
        <Image
          unoptimized
          src={artifact.url}
          alt=""
          fill
          sizes="48px"
          className="object-cover"
        />
      )}
    </div>
  )
}

export function ArtifactsScreen() {
  const [sort, setSort] = useState<ListSort<ArtifactSortField>>(
    sortOptions[0].sort
  )
  const [view, setView] = useCollectionView("artifacts")
  const [query, queryState] = trpc.artifact.list.useSuspenseInfiniteQuery(
    { sort },
    { getNextPageParam: (lastPage) => lastPage.nextCursor }
  )
  const artifacts = query.pages.flatMap((page) => page.items)
  const columns = useMemo<ColumnDef<Artifact>[]>(
    () => [
      {
        id: "thumb",
        header: "Artifact",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <ArtifactThumb artifact={row.original} />
            <Link
              href={artifactHref(row.original)}
              className="font-medium underline-offset-4 hover:underline"
            >
              {row.original.label}
            </Link>
          </div>
        ),
      },
      {
        accessorKey: "storyTitle",
        header: "Story",
        enableSorting: false,
      },
      {
        accessorKey: "kind",
        header: "Type",
        enableSorting: false,
        cell: ({ row }) => (
          <Badge variant="secondary">{kindLabels[row.original.kind]}</Badge>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        enableSorting: true,
        cell: ({ row }) => formatCollectionDate(row.original.createdAt),
      },
      {
        id: "original",
        header: () => <span className="sr-only">Original</span>,
        cell: ({ row }) => (
          <a
            href={row.original.url}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Open original
          </a>
        ),
      },
    ],
    []
  )

  return (
    <PageLayout>
      <PageHeader
        title="Artifacts"
        description="Every photo, base image, page illustration, and PDF across your stories."
      />
      {artifacts.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {view === "grid" && (
            <SortSelect
              value={sort}
              options={sortOptions}
              onValueChange={setSort}
            />
          )}
          <ViewToggle value={view} onValueChange={setView} />
        </div>
      )}
      {artifacts.length === 0 || view === "grid" ? (
        <ArtifactGrid artifacts={artifacts} />
      ) : (
        <DataTable
          columns={columns}
          data={artifacts}
          sort={sort}
          onSortChange={setSort}
          getRowHref={artifactHref}
        />
      )}
      <LoadMoreButton
        hasNextPage={Boolean(queryState.hasNextPage)}
        isFetchingNextPage={queryState.isFetchingNextPage}
        onClick={() => void queryState.fetchNextPage()}
      />
    </PageLayout>
  )
}
