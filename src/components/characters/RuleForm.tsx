"use client"

import type { FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { RuleValues } from "@/hooks/useRuleForm"
import type { Character, RuleKind } from "@/server/domain/types"

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
      <div className="grid gap-2">
        <Label>Rule type</Label>
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
      </div>
      {values.kind !== "FREEFORM" && (
        <div className="grid gap-2">
          <Label>Characters</Label>
          {characters.map((character) => (
            <label
              key={character.id}
              className="flex items-center gap-2 text-sm"
            >
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
            </label>
          ))}
          {errors.characterIds && (
            <p className="text-sm text-destructive">{errors.characterIds}</p>
          )}
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="rule-text">
          {values.kind === "FREEFORM" ? "Rule" : "Note"}
        </Label>
        <Textarea
          id="rule-text"
          value={values.text}
          onChange={(event) => onChange("text", event.target.value)}
        />
        {errors.text && (
          <p className="text-sm text-destructive">{errors.text}</p>
        )}
      </div>
      {errors.form && <p className="text-sm text-destructive">{errors.form}</p>}
      <Button type="submit" disabled={isSubmitting}>
        Save rule
      </Button>
    </form>
  )
}
