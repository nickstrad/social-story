"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import type { Character, ClientLibraryCharacter } from "@/server/domain/types"

export interface TemplateCastInput {
  templateCharacterId: string
  name: string
  include: boolean
  libraryCharacterId?: string
}

interface TemplateForUse {
  id: string
  title: string
  characters: Character[]
}

export function UseTemplateDialog({
  open,
  template,
  libraryCharacters,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  template?: TemplateForUse
  libraryCharacters: ClientLibraryCharacter[]
  isSubmitting: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: {
    title: string
    cast: TemplateCastInput[]
  }) => Promise<void>
}) {
  const [title, setTitle] = useState(template?.title ?? "")
  const [cast, setCast] = useState<TemplateCastInput[]>(() =>
    template
      ? template.characters.map((character) => ({
          templateCharacterId: character.id,
          name: character.name,
          include: !character.isOptional,
        }))
      : []
  )

  const updateCast = (
    templateCharacterId: string,
    patch: Partial<TemplateCastInput>
  ) =>
    setCast((current) =>
      current.map((entry) =>
        entry.templateCharacterId === templateCharacterId
          ? { ...entry, ...patch }
          : entry
      )
    )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Use template</DialogTitle>
          <DialogDescription>
            Name this story and fill each role slot with the people in this
            cast.
          </DialogDescription>
        </DialogHeader>

        {template && (
          <div className="grid gap-5">
            <Field>
              <FieldLabel htmlFor="template-instance-title">
                Story title
              </FieldLabel>
              <Input
                id="template-instance-title"
                value={title}
                maxLength={200}
                onChange={(event) => setTitle(event.target.value)}
              />
            </Field>

            <div className="grid gap-3">
              <FieldTitle>Cast</FieldTitle>
              {template.characters.map((character) => {
                const entry = cast.find(
                  (item) => item.templateCharacterId === character.id
                )
                if (!entry) return null
                const selectId = `library-character-${character.id}`
                const nameId = `cast-name-${character.id}`
                return (
                  <div
                    key={character.id}
                    className="grid gap-3 rounded-xl border p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{character.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {character.isOptional
                            ? "Optional role"
                            : "Required role"}
                        </p>
                      </div>
                      <FieldLabel className="items-center font-normal">
                        <Checkbox
                          checked={entry.include}
                          disabled={!character.isOptional}
                          onCheckedChange={(checked) =>
                            updateCast(character.id, { include: checked })
                          }
                        />
                        Include
                      </FieldLabel>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor={nameId}>Name</FieldLabel>
                        <Input
                          id={nameId}
                          value={entry.name}
                          maxLength={100}
                          disabled={!entry.include}
                          onChange={(event) =>
                            updateCast(character.id, {
                              name: event.target.value,
                              libraryCharacterId: undefined,
                            })
                          }
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={selectId}>
                          Saved character
                        </FieldLabel>
                        <NativeSelect
                          id={selectId}
                          className="w-full"
                          value={entry.libraryCharacterId ?? ""}
                          disabled={!entry.include}
                          onChange={(event) => {
                            const selected = libraryCharacters.find(
                              (item) => item.id === event.target.value
                            )
                            updateCast(character.id, {
                              libraryCharacterId: selected?.id,
                              ...(selected ? { name: selected.name } : {}),
                            })
                          }}
                        >
                          <NativeSelectOption value="">
                            Enter a name only
                          </NativeSelectOption>
                          {libraryCharacters.map((saved) => (
                            <NativeSelectOption key={saved.id} value={saved.id}>
                              {saved.name}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                        <FieldDescription>
                          A saved character also copies their photo and
                          appearance.
                        </FieldDescription>
                      </Field>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <DialogFooter showCloseButton>
          <Button
            disabled={
              !template ||
              !title.trim() ||
              !cast.some((entry) => entry.include) ||
              cast.some((entry) => entry.include && !entry.name.trim()) ||
              isSubmitting
            }
            onClick={async () => {
              await onSubmit({ title: title.trim(), cast })
            }}
          >
            {isSubmitting ? "Creating story…" : "Create story"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
