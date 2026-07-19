"use client"

import { ChevronLeftIcon, ChevronRightIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

export function PageMetaForm({
  isCover,
  text,
  imagePrompt,
  onChangeText,
  onChangeImagePrompt,
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
  hidden: boolean
  onToggleHidden: (hidden: boolean) => void
  onDelete: () => void
  hasPrev: boolean
  hasNext: boolean
  onPrev: () => void
  onNext: () => void
}) {
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
