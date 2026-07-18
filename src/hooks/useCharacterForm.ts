"use client"

import { useState } from "react"
import type { ClientCharacter as Character } from "@/server/domain/types"
import { useCharacterFormController } from "./useCharacterFormController"
import { useCharacters } from "./useCharacters"

export type {
  CharacterErrors,
  CharacterValues,
} from "./useCharacterFormController"

export function useCharacterForm(storyId: string, character?: Character) {
  const [isOptional, setIsOptional] = useState(character?.isOptional ?? false)
  const { create, update, invalidate } = useCharacters(storyId)
  const form = useCharacterFormController({
    character,
    storyId,
    isPending: create.isPending || update.isPending,
    save: (values) =>
      character
        ? update.mutateAsync({
            storyId,
            characterId: character.id,
            character: { ...values, isOptional },
          })
        : create.mutateAsync({
            storyId,
            character: { ...values, isOptional },
          }),
    invalidate,
    uploadUrl: "/api/upload/photo",
    uploadIdField: "characterId",
    successMessage: character ? "Character updated" : "Character added",
    failureMessage: "Could not save character",
  })
  return { ...form, isOptional, onOptionalChange: setIsOptional }
}
