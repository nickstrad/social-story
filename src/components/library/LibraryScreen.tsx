"use client"

import Image from "next/image"
import type { ColumnDef } from "@tanstack/react-table"
import { useEffect, useMemo, useState } from "react"
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { CharacterCard } from "@/components/characters/CharacterCard"
import { CharacterForm } from "@/components/characters/CharacterForm"
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { IconButton } from "@/components/ui/icon-button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { useLibraryCharacterForm } from "@/hooks/useLibraryCharacterForm"
import { useLibraryCharacters } from "@/hooks/useLibraryCharacters"
import type { ClientLibraryCharacter } from "@/server/domain/types"
import type {
  LibraryCharacterSortField,
  ListSort,
} from "@/lib/validation/listParams"

const sortOptions: SortOption<LibraryCharacterSortField>[] = [
  { label: "Newest", sort: { field: "createdAt", dir: "desc" } },
  { label: "Oldest", sort: { field: "createdAt", dir: "asc" } },
  { label: "Name A–Z", sort: { field: "name", dir: "asc" } },
  { label: "Name Z–A", sort: { field: "name", dir: "desc" } },
]

function CharacterIdentity({
  character,
}: {
  character: ClientLibraryCharacter
}) {
  return (
    <div className="flex items-center gap-2">
      <Avatar className="size-8">
        {character.photoUrl && (
          <Image
            unoptimized
            src={character.photoUrl}
            alt=""
            width={32}
            height={32}
            className="size-full object-cover"
          />
        )}
        <AvatarFallback>
          {character.name.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="font-medium">{character.name}</span>
    </div>
  )
}

function LibraryCharacterEditor({
  character,
  onDone,
  onUploadingChange,
}: {
  character?: ClientLibraryCharacter
  onDone: () => void
  onUploadingChange: (id: string | null) => void
}) {
  const form = useLibraryCharacterForm(character)
  const characterId = character?.id ?? null
  const isUploading = form.uploadState === "uploading"
  useEffect(() => {
    onUploadingChange(isUploading ? characterId : null)
    return () => onUploadingChange(null)
  }, [isUploading, characterId, onUploadingChange])
  return (
    <CharacterForm
      {...form}
      onSubmit={async (event) => {
        const saved = await form.onSubmit(event)
        if (saved) onDone()
      }}
    />
  )
}

export function LibraryScreen() {
  const [sort, setSort] = useState<ListSort<LibraryCharacterSortField>>(
    sortOptions[0].sort
  )
  const [view, setView] = useCollectionView("character-library")
  const { characters, remove, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useLibraryCharacters(sort)
  const [editing, setEditing] = useState<
    ClientLibraryCharacter | null | undefined
  >()
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ClientLibraryCharacter>()
  const columns = useMemo<ColumnDef<ClientLibraryCharacter>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        enableSorting: true,
        cell: ({ row }) => <CharacterIdentity character={row.original} />,
      },
      {
        accessorKey: "role",
        header: "Role",
        enableSorting: false,
        cell: ({ row }) => row.original.role || "—",
      },
      {
        accessorKey: "age",
        header: "Age",
        enableSorting: false,
        cell: ({ row }) => row.original.age || "—",
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
          <div className="flex flex-wrap justify-end gap-1">
            <IconButton
              variant="ghost"
              label={`Edit ${row.original.name}`}
              onClick={() => setEditing(row.original)}
            >
              <PencilIcon />
            </IconButton>
            <IconButton
              variant="ghost"
              label={`Delete ${row.original.name}`}
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
    <PageLayout width="app" spacing="relaxed">
      <PageHeader
        title="Characters"
        description="Save the people you use across stories, including their photo and appearance details."
        actions={
          <Button onClick={() => setEditing(null)}>
            <PlusIcon />
            Add character
          </Button>
        }
      />
      {characters.length > 0 && (
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
      {characters.length ? (
        view === "grid" ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {characters.map((character) => (
              <CharacterCard
                key={character.id}
                character={character}
                imagePending={uploadingId === character.id}
                onEdit={() => setEditing(character)}
                onDelete={() => setDeleteTarget(character)}
              />
            ))}
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={characters}
            sort={sort}
            onSortChange={setSort}
          />
        )
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No saved characters yet</EmptyTitle>
            <EmptyDescription>
              Add a family member once, then reuse them in any story.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      <LoadMoreButton
        hasNextPage={Boolean(hasNextPage)}
        isFetchingNextPage={isFetchingNextPage}
        onClick={() => void fetchNextPage()}
      />

      <Dialog
        open={editing !== undefined}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined)
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit ${editing.name}` : "Add character"}
            </DialogTitle>
            <DialogDescription>
              These details can be copied into any story you create.
            </DialogDescription>
          </DialogHeader>
          {editing !== undefined && (
            <LibraryCharacterEditor
              key={editing?.id ?? "new"}
              character={editing ?? undefined}
              onDone={() => setEditing(undefined)}
              onUploadingChange={setUploadingId}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(undefined)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Existing stories keep their copied character and photo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  remove.mutate({ libraryCharacterId: deleteTarget.id })
                }
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
