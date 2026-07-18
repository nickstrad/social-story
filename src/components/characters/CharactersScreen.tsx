"use client"

import { useEffect, useState } from "react"
import { PlusIcon, UsersIcon } from "lucide-react"
import { AddFromLibraryDialog } from "./AddFromLibraryDialog"
import { CharacterCard } from "./CharacterCard"
import { CharacterForm } from "./CharacterForm"
import { RuleForm } from "./RuleForm"
import { RuleList } from "./RuleList"
import { PageHeader } from "@/components/layout/PageHeader"
import { PageLayout } from "@/components/layout/PageLayout"
import { StoryStepsNav } from "@/components/story/StoryStepsNav"
import { StoryFlowFooter } from "@/components/story/StoryFlowFooter"
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
import { Empty, EmptyDescription } from "@/components/ui/empty"
import { useCharacterForm } from "@/hooks/useCharacterForm"
import { useCharacters } from "@/hooks/useCharacters"
import { useLibraryCharacters } from "@/hooks/useLibraryCharacters"
import { useRuleForm } from "@/hooks/useRuleForm"
import { useRules } from "@/hooks/useRules"
import { deriveStepStates } from "@/lib/steps"
import { trpc } from "@/lib/trpc"
import type {
  ClientCharacter as Character,
  Rule,
  StoryKind,
} from "@/server/domain/types"

function CharacterEditor({
  storyId,
  character,
  onDone,
  onUploadingChange,
  showOptional,
}: {
  storyId: string
  character?: Character
  onDone: () => void
  onUploadingChange: (id: string | null) => void
  showOptional: boolean
}) {
  const form = useCharacterForm(storyId, character)
  const characterId = character?.id ?? null
  const isUploading = form.uploadState === "uploading"
  useEffect(() => {
    onUploadingChange(isUploading ? characterId : null)
    return () => onUploadingChange(null)
  }, [isUploading, characterId, onUploadingChange])
  return (
    <CharacterForm
      {...form}
      showOptional={showOptional}
      onSubmit={async (event) => {
        const saved = await form.onSubmit(event)
        if (saved) onDone()
      }}
    />
  )
}
function RuleEditor({
  storyId,
  rule,
  characters,
  onDone,
}: {
  storyId: string
  rule?: Rule
  characters: Character[]
  onDone: () => void
}) {
  const form = useRuleForm(storyId, rule)
  return (
    <RuleForm
      {...form}
      characters={characters}
      onSubmit={async (event) => {
        const saved = await form.onSubmit(event)
        if (saved) onDone()
      }}
    />
  )
}

export function CharactersScreen({
  storyId,
  storyKind,
}: {
  storyId: string
  storyKind: StoryKind
}) {
  const [story] = trpc.story.get.useSuspenseQuery({ storyId, kind: storyKind })
  const {
    characters,
    remove: removeCharacter,
    addFromLibrary,
    saveToLibrary,
  } = useCharacters(storyId)
  const { characters: libraryCharacters } = useLibraryCharacters()
  const { rules, remove: removeRule } = useRules(storyId)
  const [editingCharacter, setEditingCharacter] = useState<
    Character | null | undefined
  >()
  const [uploadingCharacterId, setUploadingCharacterId] = useState<
    string | null
  >(null)
  const [editingRule, setEditingRule] = useState<Rule | null | undefined>()
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "character" | "rule"
    id: string
    name: string
  }>()

  function deleteSelected() {
    if (!deleteTarget) return
    if (deleteTarget.type === "character") {
      removeCharacter.mutate({ storyId, characterId: deleteTarget.id })
    } else {
      removeRule.mutate({ storyId, ruleId: deleteTarget.id })
    }
    setDeleteTarget(undefined)
  }

  const steps = deriveStepStates({
    kind: story.kind,
    status: story.status,
    script: story.script,
    charactersCount: characters.length,
    baseImageUrl: story.baseImageUrl,
    pagesCount: story.counts.pages,
    pagesWithImageCount: story.counts.pagesWithImage,
  })

  return (
    <PageLayout spacing="relaxed">
      <StoryStepsNav
        storyId={storyId}
        steps={steps}
        current="characters"
        kind={story.kind}
      />
      <section className="grid gap-section">
        <PageHeader
          title="Characters"
          description="Add the people who should stay recognizable throughout this story."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setLibraryOpen(true)}>
                <UsersIcon />
                Add from library
              </Button>
              <Button onClick={() => setEditingCharacter(null)}>
                <PlusIcon />
                Add character
              </Button>
            </div>
          }
        />
        {characters.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {characters.map((character) => (
              <CharacterCard
                key={character.id}
                character={character}
                imagePending={uploadingCharacterId === character.id}
                onEdit={() => setEditingCharacter(character)}
                onDelete={() =>
                  setDeleteTarget({
                    type: "character",
                    id: character.id,
                    name: character.name,
                  })
                }
                onSaveToLibrary={
                  character.libraryCharacterId
                    ? undefined
                    : () =>
                        saveToLibrary.mutate({
                          storyId,
                          characterId: character.id,
                        })
                }
              />
            ))}
          </div>
        ) : (
          <Empty className="border">
            <EmptyDescription>
              Start by adding the main character.
            </EmptyDescription>
          </Empty>
        )}
      </section>
      <section className="grid gap-section">
        <PageHeader
          size="section"
          title="Visual rules"
          description="Tell image generation who appears together—or who should not."
          actions={
            <Button
              variant="outline"
              disabled={!characters.length}
              onClick={() => setEditingRule(null)}
            >
              <PlusIcon />
              Add rule
            </Button>
          }
        />
        <RuleList
          rules={rules}
          characters={characters}
          onEdit={setEditingRule}
          onDelete={(rule) =>
            setDeleteTarget({ type: "rule", id: rule.id, name: "this rule" })
          }
        />
      </section>
      <StoryFlowFooter
        storyId={storyId}
        steps={steps}
        current="characters"
        kind={story.kind}
      />
      <AddFromLibraryDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        characters={libraryCharacters}
        existingIds={
          new Set(
            characters.flatMap((character) =>
              character.libraryCharacterId ? [character.libraryCharacterId] : []
            )
          )
        }
        isSubmitting={addFromLibrary.isPending}
        onSubmit={async (libraryCharacterIds) => {
          await addFromLibrary.mutateAsync({ storyId, libraryCharacterIds })
        }}
      />
      <Dialog
        open={editingCharacter !== undefined}
        onOpenChange={(open) => {
          if (!open) setEditingCharacter(undefined)
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingCharacter
                ? `Edit ${editingCharacter.name}`
                : "Add character"}
            </DialogTitle>
            <DialogDescription>
              Describe this person and optionally add a clear reference photo.
            </DialogDescription>
          </DialogHeader>
          {editingCharacter !== undefined && (
            <CharacterEditor
              key={editingCharacter?.id ?? "new"}
              storyId={storyId}
              character={editingCharacter ?? undefined}
              onDone={() => setEditingCharacter(undefined)}
              onUploadingChange={setUploadingCharacterId}
              showOptional={story.kind === "TEMPLATE"}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={editingRule !== undefined}
        onOpenChange={(open) => {
          if (!open) setEditingRule(undefined)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Edit rule" : "Add visual rule"}
            </DialogTitle>
            <DialogDescription>
              Rules guide which characters belong in generated images.
            </DialogDescription>
          </DialogHeader>
          {editingRule !== undefined && (
            <RuleEditor
              key={editingRule?.id ?? "new"}
              storyId={storyId}
              rule={editingRule ?? undefined}
              characters={characters}
              onDone={() => setEditingRule(undefined)}
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
              This cannot be undone. Character references are also removed from
              existing rules.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteSelected}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  )
}
