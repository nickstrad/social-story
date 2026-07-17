"use client"

import type { FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldError,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { RuleValues } from "@/hooks/useRuleForm"
import type {
  ClientCharacter as Character,
  RuleKind,
} from "@/server/domain/types"

const kinds: { value: RuleKind; label: string }[] = [
  { value: "TOGETHER", label: "Together" },
  { value: "ALWAYS_INCLUDE", label: "Always" },
  { value: "NEVER_INCLUDE", label: "Never" },
  { value: "FREEFORM", label: "Freeform" },
]
export function RuleForm({
  values,
  errors,
  characters,
  isSubmitting,
  onChange,
  onSubmit,
}: {
  values: RuleValues
  errors: Record<string, string>
  characters: Character[]
  isSubmitting?: boolean
  onChange: <K extends keyof RuleValues>(field: K, value: RuleValues[K]) => void
  onSubmit: (event: FormEvent) => void
}) {
  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <Field>
        <FieldTitle>Rule type</FieldTitle>
        <ToggleGroup
          value={[values.kind]}
          onValueChange={(selected) => {
            const value = selected[0] as RuleKind | undefined
            if (value) onChange("kind", value)
          }}
          variant="outline"
        >
          {kinds.map((kind) => (
            <ToggleGroupItem key={kind.value} value={kind.value}>
              {kind.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>
      {values.kind !== "FREEFORM" && (
        <Field>
          <FieldTitle>Characters</FieldTitle>
          {characters.map((character) => (
            <FieldLabel key={character.id} className="font-normal">
              <Checkbox
                checked={values.characterIds.includes(character.id)}
                onCheckedChange={(checked) =>
                  onChange(
                    "characterIds",
                    checked
                      ? [...values.characterIds, character.id]
                      : values.characterIds.filter((id) => id !== character.id)
                  )
                }
              />
              {character.name}
            </FieldLabel>
          ))}
          <FieldError>{errors.characterIds}</FieldError>
        </Field>
      )}
      <Field>
        <FieldLabel htmlFor="rule-text">
          {values.kind === "FREEFORM" ? "Rule" : "Note"}
        </FieldLabel>
        <Textarea
          id="rule-text"
          value={values.text}
          onChange={(event) => onChange("text", event.target.value)}
        />
        <FieldError>{errors.text}</FieldError>
      </Field>
      <FieldError>{errors.form}</FieldError>
      <Button type="submit" disabled={isSubmitting}>
        Save rule
      </Button>
    </form>
  )
}
