"use client"

import type { FormEvent } from "react"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { CharacterErrors, CharacterValues } from "@/hooks/useCharacterForm"

export function CharacterForm(props: {
  values: CharacterValues
  errors: CharacterErrors
  photoPreviewUrl: string
  uploadState: "idle" | "uploading" | "error"
  isSubmitting?: boolean
  onChange: (field: keyof CharacterValues, value: string) => void
  onPickFile: (file: File) => void
  onSubmit: (event: FormEvent) => void
}) {
  const field = (
    name: keyof CharacterValues,
    label: string,
    multiline = false
  ) => (
    <Field>
      <FieldLabel htmlFor={`character-${name}`}>{label}</FieldLabel>
      {multiline ? (
        <Textarea
          id={`character-${name}`}
          value={props.values[name]}
          onChange={(event) => props.onChange(name, event.target.value)}
        />
      ) : (
        <Input
          id={`character-${name}`}
          value={props.values[name]}
          onChange={(event) => props.onChange(name, event.target.value)}
        />
      )}
      <FieldError>{props.errors[name]}</FieldError>
    </Field>
  )
  return (
    <form className="grid gap-4" onSubmit={props.onSubmit}>
      {field("name", "Name")}
      <div className="grid grid-cols-2 gap-3">
        {field("role", "Role")}
        {field("age", "Age")}
      </div>
      {field("appearance", "Appearance", true)}
      {field("photoDescription", "Photo description", true)}
      <Field>
        <FieldLabel htmlFor="character-photo">Photo</FieldLabel>
        <div className="flex items-center gap-3">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
            {props.photoPreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- blob: preview URLs aren't served by next/image
              <img
                src={props.photoPreviewUrl}
                alt="Selected photo preview"
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                No photo
              </div>
            )}
          </div>
          <Input
            id="character-photo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) props.onPickFile(file)
            }}
          />
        </div>
        <FieldDescription>PNG, JPEG, or WebP up to 8 MB.</FieldDescription>
      </Field>
      <FieldError>{props.errors.form}</FieldError>
      <Button type="submit" disabled={props.isSubmitting}>
        {props.uploadState === "uploading"
          ? "Uploading photo…"
          : "Save character"}
      </Button>
    </form>
  )
}
