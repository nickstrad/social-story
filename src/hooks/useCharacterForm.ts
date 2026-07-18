"use client"

import type { ClientCharacter as Character } from "@/server/domain/types"
import { useCharacterFormController } from "./useCharacterFormController"
import { useCharacters } from "./useCharacters"

export type {
  CharacterErrors,
  CharacterValues,
} from "./useCharacterFormController"

export function useCharacterForm(storyId: string, character?: Character) {
  const { create, update, invalidate } = useCharacters(storyId)
  return useCharacterFormController({
    character,
    storyId,
    isPending: create.isPending || update.isPending,
    save: (values) =>
      character
        ? update.mutateAsync({
            storyId,
            characterId: character.id,
            character: values,
          })
        : create.mutateAsync({ storyId, character: values }),
    invalidate,
    uploadUrl: "/api/upload/photo",
    uploadIdField: "characterId",
    successMessage: character ? "Character updated" : "Character added",
    failureMessage: "Could not save character",
  })
}
