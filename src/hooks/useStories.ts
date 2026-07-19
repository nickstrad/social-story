"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc"
import type { ListSort, StorySortField } from "@/lib/validation/listParams"

const defaultSort: ListSort<StorySortField> = {
  field: "createdAt",
  dir: "desc",
}

export function useStories(sort = defaultSort) {
  const utils = trpc.useUtils()
  const router = useRouter()
  const [query, queryState] = trpc.story.list.useSuspenseInfiniteQuery(
    { sort },
    { getNextPageParam: (lastPage) => lastPage.nextCursor }
  )
  const stories = query.pages.flatMap((page) => page.items)
  const invalidate = () => utils.story.list.invalidate()

  const create = trpc.story.create.useMutation({
    onSuccess: async (story) => {
      await invalidate()
      router.push(`/stories/${story.id}/script`)
    },
  })

  const remove = trpc.story.delete.useMutation({
    onSuccess: async () => {
      await invalidate()
      toast.success("Story deleted")
    },
  })

  return { stories, create, remove, ...queryState }
}
