"use client"

import { type ChangeEvent, type FormEvent } from "react"
import { InfoIcon } from "lucide-react"
import { CharacterPhotoField } from "./CharacterPhotoField"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { CharacterErrors, CharacterValues } from "@/hooks/useCharacterForm"

interface CharacterFormProps {
  values: CharacterValues
  errors: CharacterErrors
  photoPreviewUrl: string
  uploadState: "idle" | "uploading" | "error"
  autofillState: "idle" | "loading" | "error"
  canAutofill: boolean
  isSubmitting?: boolean
  showOptional?: boolean
  isOptional?: boolean
  onChange: (field: keyof CharacterValues, value: string) => void
  onPickFile: (file: File) => void
  onAutofill: () => void
  onSubmit: (event: FormEvent) => void
  onOptionalChange?: (value: boolean) => void
}

function CharacterTextField({
  name,
  label,
  multiline = false,
  values,
  errors,
  onChange,
}: Pick<CharacterFormProps, "values" | "errors" | "onChange"> & {
  name: keyof CharacterValues
  label: string
  multiline?: boolean
}) {
  const id = `character-${name}`
  const controlProps = {
    id,
    value: values[name],
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(name, event.target.value),
  }
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {multiline ? <Textarea {...controlProps} /> : <Input {...controlProps} />}
      <FieldError>{errors[name]}</FieldError>
    </Field>
  )
}

export function CharacterForm({
  values,
  errors,
  photoPreviewUrl,
  uploadState,
  autofillState,
  canAutofill,
  isSubmitting,
  showOptional,
  isOptional,
  onChange,
  onPickFile,
  onAutofill,
  onSubmit,
  onOptionalChange,
}: CharacterFormProps) {
  const fieldProps = { values, errors, onChange }
  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <Alert>
        <InfoIcon />
        <AlertTitle>Start with a clear photo</AlertTitle>
        <AlertDescription>
          Attach or drop a photo, then choose Auto-fill from photo. We’ll
          suggest neutral appearance and photo details for you to review before
          saving.
        </AlertDescription>
      </Alert>
      <CharacterTextField {...fieldProps} name="name" label="Name" />
      {showOptional && (
        <Field orientation="horizontal">
          <FieldContent>
            <FieldTitle>Optional slot</FieldTitle>
            <FieldDescription>
              People using this template may leave this role out of the cast.
            </FieldDescription>
          </FieldContent>
          <Switch
            checked={isOptional}
            aria-label="Optional slot"
            onCheckedChange={onOptionalChange}
          />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <CharacterTextField {...fieldProps} name="role" label="Role" />
        <CharacterTextField {...fieldProps} name="age" label="Age" />
      </div>
      <CharacterTextField
        {...fieldProps}
        name="appearance"
        label="Appearance"
        multiline
      />
      <CharacterTextField
        {...fieldProps}
        name="photoDescription"
        label="Photo description"
        multiline
      />
      <CharacterPhotoField
        photoPreviewUrl={photoPreviewUrl}
        autofillState={autofillState}
        canAutofill={canAutofill}
        error={errors.photo}
        onPickFile={onPickFile}
        onAutofill={onAutofill}
      />
      <FieldError>{errors.form}</FieldError>
      <Button type="submit" disabled={isSubmitting}>
        {uploadState === "uploading" ? "Uploading photo…" : "Save character"}
      </Button>
    </form>
  )
}
