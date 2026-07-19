"use client"

import { WandSparklesIcon } from "lucide-react"

import { Field, FieldDescription, FieldTitle } from "@/components/ui/field"
import { Toggle } from "@/components/ui/toggle"
import type { CharacterChip } from "@/lib/pagesEditor"

function hint(chips: CharacterChip[]): string {
  if (chips.length === 0)
    return "No characters yet — add them in the Characters step."
  if (!chips.some((chip) => chip.effective))
    return "Scene only — no people on this page."
  return chips.some((chip) => chip.ruleLocked)
    ? "Tap a name to add or remove them. A wand marks someone a visual rule decides."
    : "Tap a name to add or remove them."
}

/**
 * Who will be drawn, shown immediately above the generate controls. Chips read
 * the *effective* cast (post-rules), so a character a rule pulls in is visible
 * and marked rather than silently appearing in the artwork.
 */
export function PageCharacterChips({
  chips,
  isCover,
  disabled,
  onToggleCharacter,
}: {
  chips: CharacterChip[]
  isCover: boolean
  disabled?: boolean
  onToggleCharacter: (characterId: string) => void
}) {
  return (
    <Field>
      <FieldTitle>In this image</FieldTitle>
      {isCover ? (
        // The cover branch of the PAGE_IMAGE task always draws the full cast and
        // never reads the page's own selection, so offering chips here would
        // promise control that does not exist.
        <FieldDescription>
          The cover always shows the full cast.
        </FieldDescription>
      ) : (
        <>
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <Toggle
                  key={chip.id}
                  variant="outline"
                  pressed={chip.effective}
                  disabled={disabled || chip.ruleLocked}
                  onPressedChange={() => onToggleCharacter(chip.id)}
                >
                  {chip.ruleLocked && <WandSparklesIcon />}
                  {chip.name}
                </Toggle>
              ))}
            </div>
          )}
          <FieldDescription>{hint(chips)}</FieldDescription>
        </>
      )}
    </Field>
  )
}
