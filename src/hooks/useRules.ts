"use client"

import { toast } from "sonner"
import { trpc } from "@/lib/trpc"

export function useRules(storyId: string) {
  const utils = trpc.useUtils()
  const [rules] = trpc.rule.listForStory.useSuspenseQuery({ storyId })
  const invalidate = () => utils.rule.listForStory.invalidate({ storyId })
  const create = trpc.rule.create.useMutation({ onSuccess: invalidate })
  const update = trpc.rule.update.useMutation({ onSuccess: invalidate })
  const remove = trpc.rule.delete.useMutation({
    onSuccess: async () => {
      await invalidate()
      toast.success("Rule deleted")
    },
  })
  return { rules, create, update, remove }
}
