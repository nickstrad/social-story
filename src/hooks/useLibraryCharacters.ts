"use client"

import { toast } from "sonner"

import { trpc } from "@/lib/trpc"
import type {
  LibraryCharacterSortField,
  ListSort,
} from "@/lib/validation/listParams"

const defaultSort: ListSort<LibraryCharacterSortField> = {
  field: "createdAt",
  dir: "desc",
}

export function useLibraryCharacters(sort = defaultSort) {
  const utils = trpc.useUtils()
  const [query, queryState] =
    trpc.library.characters.list.useSuspenseInfiniteQuery(
      { sort },
      { getNextPageParam: (lastPage) => lastPage.nextCursor }
    )
  const characters = query.pages.flatMap((page) => page.items)
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
  return { characters, create, update, remove, invalidate, ...queryState }
}
