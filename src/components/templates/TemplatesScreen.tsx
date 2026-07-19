"use client"

import type { inferRouterOutputs } from "@trpc/server"
import type { ColumnDef } from "@tanstack/react-table"
import Link from "next/link"
import { useMemo, useState } from "react"
import {
  LayoutTemplateIcon,
  PencilIcon,
  PlayIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { UseTemplateDialog } from "./UseTemplateDialog"
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
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { useInstantiateTemplate } from "@/hooks/useInstantiateTemplate"
import { trpc } from "@/lib/trpc"
import type { AppRouter } from "@/server/api/root"
import type { ListSort, StorySortField } from "@/lib/validation/listParams"

type Template =
  inferRouterOutputs<AppRouter>["template"]["list"]["items"][number]

const sortOptions: SortOption<StorySortField>[] = [
  { label: "Newest", sort: { field: "createdAt", dir: "desc" } },
  { label: "Oldest", sort: { field: "createdAt", dir: "asc" } },
  { label: "Name A–Z", sort: { field: "title", dir: "asc" } },
  { label: "Name Z–A", sort: { field: "title", dir: "desc" } },
]

export function TemplatesScreen() {
  const utils = trpc.useUtils()
  const [sort, setSort] = useState<ListSort<StorySortField>>(
    sortOptions[0].sort
  )
  const [view, setView] = useCollectionView("templates")
  const [templatesQuery, templatesState] =
    trpc.template.list.useSuspenseInfiniteQuery(
      { sort },
      { getNextPageParam: (lastPage) => lastPage.nextCursor }
    )
  const templates = templatesQuery.pages.flatMap((page) => page.items)
  const [libraryQuery, libraryState] =
    trpc.library.characters.list.useSuspenseInfiniteQuery(
      { sort: { field: "createdAt", dir: "desc" } },
      { getNextPageParam: (lastPage) => lastPage.nextCursor }
    )
  const libraryCharacters = libraryQuery.pages.flatMap((page) => page.items)
  const [useTarget, setUseTarget] = useState<Template>()
  const [deleteTarget, setDeleteTarget] = useState<Template>()
  const template = trpc.template.getForUse.useQuery(
    { templateId: useTarget?.id ?? "" },
    { enabled: Boolean(useTarget) }
  )
  const instantiate = useInstantiateTemplate()
  const remove = trpc.story.delete.useMutation({
    onSuccess: async () => {
      await utils.template.list.invalidate()
      toast.success("Template deleted")
    },
    onError: (error) => toast.error(error.message),
  })
  const columns = useMemo<ColumnDef<Template>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Title",
        enableSorting: true,
        cell: ({ row }) => row.original.title.trim() || "Untitled template",
      },
      {
        id: "pages",
        header: "Pages",
        cell: ({ row }) => row.original.counts.pages,
      },
      {
        id: "characters",
        header: "Characters",
        cell: ({ row }) => row.original.counts.characters,
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        enableSorting: true,
        cell: ({ row }) => formatCollectionDate(row.original.createdAt),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" onClick={() => setUseTarget(row.original)}>
              <PlayIcon />
              Use
            </Button>
            <Button
              size="sm"
              variant="outline"
              render={
                <Link href={`/stories/${row.original.id}/script?template=1`} />
              }
            >
              <PencilIcon />
              Edit
            </Button>
            <IconButton
              variant="ghost"
              label="Delete template"
              onClick={() => setDeleteTarget(row.original)}
            >
              <Trash2Icon />
            </IconButton>
          </div>
        ),
      },
    ],
    [setDeleteTarget, setUseTarget]
  )

  return (
    <PageLayout spacing="relaxed">
      <PageHeader
        title="Templates"
        description="Reuse a finished script, cast structure, and page plan for new people."
      />

      {templates.length > 0 && (
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

      {templates.length > 0 && view === "grid" ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <CardTitle className="truncate">
                  {item.title.trim() || "Untitled template"}
                </CardTitle>
                <CardDescription>
                  {item.counts.characters} role
                  {item.counts.characters === 1 ? "" : "s"} ·{" "}
                  {item.counts.pages} page{item.counts.pages === 1 ? "" : "s"}
                </CardDescription>
                <CardAction>
                  <IconButton
                    variant="ghost"
                    label="Delete template"
                    onClick={() => setDeleteTarget(item)}
                  >
                    <Trash2Icon />
                  </IconButton>
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                <Button onClick={() => setUseTarget(item)}>
                  <PlayIcon />
                  Use template
                </Button>
                <Button
                  variant="outline"
                  render={
                    <Link href={`/stories/${item.id}/script?template=1`} />
                  }
                >
                  <PencilIcon />
                  Edit
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : templates.length ? (
        <DataTable
          columns={columns}
          data={templates}
          sort={sort}
          onSortChange={setSort}
          nextPage={{
            hasNext: Boolean(templatesState.hasNextPage),
            isFetching: templatesState.isFetchingNextPage,
            fetch: templatesState.fetchNextPage,
          }}
        />
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LayoutTemplateIcon />
            </EmptyMedia>
            <EmptyTitle>No templates yet</EmptyTitle>
            <EmptyDescription>
              Finish a story, then save it as a reusable template from Export.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {view === "grid" && (
        <LoadMoreButton
          hasNextPage={Boolean(templatesState.hasNextPage)}
          isFetchingNextPage={templatesState.isFetchingNextPage}
          onClick={() => void templatesState.fetchNextPage()}
        />
      )}

      <UseTemplateDialog
        key={`${useTarget?.id ?? "closed"}:${template.data?.id ?? "loading"}`}
        open={Boolean(useTarget)}
        template={template.data}
        libraryCharacters={libraryCharacters}
        hasNextLibraryPage={Boolean(libraryState.hasNextPage)}
        isFetchingNextLibraryPage={libraryState.isFetchingNextPage}
        onLoadMoreLibrary={() => void libraryState.fetchNextPage()}
        isSubmitting={instantiate.isPending}
        onOpenChange={(open) => {
          if (!open) setUseTarget(undefined)
        }}
        onSubmit={async ({ title, cast }) => {
          if (!useTarget) return
          await instantiate.mutateAsync({
            templateId: useTarget.id,
            title,
            cast,
          })
        }}
      />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(undefined)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>
              Existing stories created from it stay intact. This cannot be
              undone.
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
