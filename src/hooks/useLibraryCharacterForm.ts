"use client"

import type { ClientLibraryCharacter } from "@/server/domain/types"
import { useCharacterFormController } from "./useCharacterFormController"
import { useLibraryCharacters } from "./useLibraryCharacters"

export function useLibraryCharacterForm(character?: ClientLibraryCharacter) {
  const { create, update, invalidate } = useLibraryCharacters()
  return useCharacterFormController({
    character,
    isPending: create.isPending || update.isPending,
    save: (values) =>
      character
        ? update.mutateAsync({
            libraryCharacterId: character.id,
            character: values,
          })
        : create.mutateAsync({ character: values }),
    invalidate,
    uploadUrl: "/api/upload/library-photo",
    uploadIdField: "libraryCharacterId",
    successMessage: character ? "Character updated" : "Character added",
    failureMessage: "Could not save character",
  })
}
