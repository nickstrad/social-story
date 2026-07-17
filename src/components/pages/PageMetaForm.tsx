"use client"

import { ChevronLeftIcon, ChevronRightIcon, Trash2Icon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { ClientCharacter as Character } from "@/server/domain/types"

export function PageMetaForm({
  isCover,
  text,
  imagePrompt,
  onChangeText,
  onChangeImagePrompt,
  characters,
  selectedCharacterIds,
  effectiveCharacterIds,
  onToggleCharacter,
  hidden,
  onToggleHidden,
  onDelete,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
}: {
  isCover: boolean
  text: string
  imagePrompt: string
  onChangeText: (value: string) => void
  onChangeImagePrompt: (value: string) => void
  characters: Character[]
  selectedCharacterIds: string[]
  effectiveCharacterIds: string[]
  onToggleCharacter: (characterId: string) => void
  hidden: boolean
  onToggleHidden: (hidden: boolean) => void
  onDelete: () => void
  hasPrev: boolean
  hasNext: boolean
  onPrev: () => void
  onNext: () => void
}) {
  const selected = new Set(selectedCharacterIds)
  const effective = new Set(effectiveCharacterIds)

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" disabled={!hasPrev} onClick={onPrev}>
          <ChevronLeftIcon />
          Prev
        </Button>
        <Button variant="ghost" size="sm" disabled={!hasNext} onClick={onNext}>
          Next
          <ChevronRightIcon />
        </Button>
      </div>

      <Field>
        <FieldLabel htmlFor="page-text">Page text</FieldLabel>
        <Textarea
          id="page-text"
          rows={3}
          value={text}
          onChange={(event) => onChangeText(event.target.value)}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="page-prompt">Image prompt</FieldLabel>
        <Textarea
          id="page-prompt"
          rows={4}
          value={imagePrompt}
          onChange={(event) => onChangeImagePrompt(event.target.value)}
        />
      </Field>

      <Field>
        <FieldTitle>Characters</FieldTitle>
        {characters.length === 0 ? (
          <FieldDescription>
            No characters yet — add them in the Characters step.
          </FieldDescription>
        ) : (
          <div className="grid gap-field">
            {characters.map((character) => {
              const byRule =
                !selected.has(character.id) && effective.has(character.id)
              return (
                <FieldLabel key={character.id} className="font-normal">
                  <Checkbox
                    checked={selected.has(character.id)}
                    onCheckedChange={() => onToggleCharacter(character.id)}
                  />
                  {character.name}
                  {byRule && (
                    <Badge variant="secondary" className="ml-1">
                      added by rule
                    </Badge>
                  )}
                </FieldLabel>
              )
            })}
          </div>
        )}
      </Field>

      {!isCover && (
        <div className="flex items-center justify-between border-t pt-4">
          <FieldLabel className="font-normal">
            <Switch checked={hidden} onCheckedChange={onToggleHidden} />
            Hidden from export
          </FieldLabel>
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2Icon />
            Delete
          </Button>
        </div>
      )}
    </div>
  )
}
