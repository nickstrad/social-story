"use client"

import { toast } from "sonner"

import { trpc } from "@/lib/trpc"

export function useLibraryCharacters() {
  const utils = trpc.useUtils()
  const [characters] = trpc.library.characters.list.useSuspenseQuery()
  const invalidate = () => utils.library.characters.list.invalidate()
  const create = trpc.library.characters.create.useMutation({
    onSuccess: invalidate,
  })
  const update = trpc.library.characters.update.useMutation({
    onSuccess: invalidate,
  })
  const remove = trpc.library.characters.delete.useMutation({
    onSuccess: async () => {
      await invalidate()
      toast.success("Character deleted from library")
    },
  })
  return { characters, create, update, remove, invalidate }
}
