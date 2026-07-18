"use client"

import { useEffect, useState } from "react"
import { PlusIcon } from "lucide-react"

import { CharacterCard } from "@/components/characters/CharacterCard"
import { CharacterForm } from "@/components/characters/CharacterForm"
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
  const { characters, remove } = useLibraryCharacters()
  const [editing, setEditing] = useState<
    ClientLibraryCharacter | null | undefined
  >()
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ClientLibraryCharacter>()

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
      {characters.length ? (
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
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No saved characters yet</EmptyTitle>
            <EmptyDescription>
              Add a family member once, then reuse them in any story.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

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
