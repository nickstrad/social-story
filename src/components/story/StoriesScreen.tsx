"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { StoryList } from "./StoryList"
import { DataTable } from "@/components/collections/DataTable"
import { formatCollectionDate } from "@/components/collections/formatDate"
import { LoadMoreButton } from "@/components/collections/LoadMoreButton"
import {
  SortSelect,
  type SortOption,
} from "@/components/collections/SortSelect"
import { useCollectionView } from "@/components/collections/useCollectionView"
import { ViewToggle } from "@/components/collections/ViewToggle"
import { PageHeader } from "@/components/layout/PageHeader"
import { PageLayout } from "@/components/layout/PageLayout"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/ui/icon-button"
import { useStories } from "@/hooks/useStories"
import { storyTitle } from "@/server/domain/storyTitle"
import type { Story } from "@/server/domain/types"
import type { ListSort, StorySortField } from "@/lib/validation/listParams"

const sortOptions: SortOption<StorySortField>[] = [
  { label: "Newest", sort: { field: "createdAt", dir: "desc" } },
  { label: "Oldest", sort: { field: "createdAt", dir: "asc" } },
  { label: "Recently updated", sort: { field: "updatedAt", dir: "desc" } },
  { label: "Name A–Z", sort: { field: "title", dir: "asc" } },
  { label: "Name Z–A", sort: { field: "title", dir: "desc" } },
]

export function StoriesScreen() {
  const router = useRouter()
  const [sort, setSort] = useState<ListSort<StorySortField>>(
    sortOptions[0].sort
  )
  const [view, setView] = useCollectionView("stories")
  const { stories, remove, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useStories(sort)
  const [deleteTarget, setDeleteTarget] = useState<Story>()
  const columns = useMemo<ColumnDef<Story>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Title",
        enableSorting: true,
        cell: ({ row }) => (
          <Link
            href={`/stories/${row.original.id}/script`}
            className="font-medium underline-offset-4 hover:underline"
          >
            {storyTitle(row.original)}
          </Link>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        enableSorting: true,
        cell: ({ row }) => formatCollectionDate(row.original.createdAt),
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        enableSorting: true,
        cell: ({ row }) => formatCollectionDate(row.original.updatedAt),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-wrap justify-end gap-1">
            <IconButton
              variant="ghost"
              label="Delete story"
              onClick={() => setDeleteTarget(row.original)}
            >
              <Trash2Icon />
            </IconButton>
          </div>
        ),
      },
    ],
    []
  )

  return (
    <PageLayout>
      <PageHeader
        title="Your stories"
        description="Turn a social-story script into an illustrated picture book."
        actions={
          <Button onClick={() => router.push("/stories/new")}>
            <PlusIcon />
            New story
          </Button>
        }
      />

      {stories.length > 0 && (
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

      {stories.length === 0 || view === "grid" ? (
        <StoryList
          stories={stories}
          onNew={() => router.push("/stories/new")}
          onDelete={setDeleteTarget}
        />
      ) : (
        <DataTable
          columns={columns}
          data={stories}
          sort={sort}
          onSortChange={setSort}
          getRowHref={(story) => `/stories/${story.id}/script`}
          nextPage={{
            hasNext: Boolean(hasNextPage),
            isFetching: isFetchingNextPage,
            fetch: fetchNextPage,
          }}
        />
      )}

      {view === "grid" && (
        <LoadMoreButton
          hasNextPage={Boolean(hasNextPage)}
          isFetchingNextPage={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        />
      )}

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(undefined)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget?.title.trim() || "this story"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the story, its pages, characters, and
              generated images. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) remove.mutate({ storyId: deleteTarget.id })
                setDeleteTarget(undefined)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  )
}
