"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc"

export function useStories() {
  const utils = trpc.useUtils()
  const router = useRouter()
  const [stories] = trpc.story.list.useSuspenseQuery()
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

  return { stories, create, remove }
}
