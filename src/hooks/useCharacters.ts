"use client"

import { toast } from "sonner"
import { trpc } from "@/lib/trpc"

export function useCharacters(storyId: string) {
  const utils = trpc.useUtils()
  const [characters] = trpc.character.listForStory.useSuspenseQuery({ storyId })
  const invalidate = () => utils.character.listForStory.invalidate({ storyId })
  const create = trpc.character.create.useMutation({ onSuccess: invalidate })
  const update = trpc.character.update.useMutation({ onSuccess: invalidate })
  const addFromLibrary = trpc.character.addFromLibrary.useMutation({
    onSuccess: async () => {
      await Promise.all([invalidate(), utils.story.get.invalidate({ storyId })])
      toast.success("Characters added from library")
    },
    onError: (error) => toast.error(error.message),
  })
  const saveToLibrary = trpc.character.saveToLibrary.useMutation({
    onSuccess: async () => {
      await Promise.all([
        invalidate(),
        utils.library.characters.list.invalidate(),
      ])
      toast.success("Character saved to library")
    },
    onError: (error) => toast.error(error.message),
  })
  const remove = trpc.character.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        invalidate(),
        utils.rule.listForStory.invalidate({ storyId }),
      ])
      toast.success("Character deleted")
    },
  })
  return {
    characters,
    create,
    update,
    remove,
    addFromLibrary,
    saveToLibrary,
    invalidate,
  }
}
