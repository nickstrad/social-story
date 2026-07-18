"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { trpc } from "@/lib/trpc"

export function useInstantiateTemplate() {
  const router = useRouter()
  const utils = trpc.useUtils()
  const instantiate = trpc.template.instantiate.useMutation({
    onSuccess: async ({ storyId }) => {
      await utils.story.list.invalidate()
      router.push(`/stories/${storyId}/characters`)
    },
    onError: (error) => toast.error(error.message),
  })
  return instantiate
}
