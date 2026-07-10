"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"

import { summarizeStoryTasks } from "@/server/domain/taskMachine"
import { isAllSelected, selectAll, selectNone, toggle } from "@/lib/selection"
import { trpc } from "@/lib/trpc"
import { useStoryTasks } from "@/hooks/useTaskPolling"

export function useBulkGeneration(storyId: string, pageIds: string[]) {
  const utils = trpc.useUtils()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const { tasks } = useStoryTasks(storyId)

  // Aggregate progress across this story's PAGE_IMAGE tasks only, so a base
  // image or parse task doesn't leak into the bulk-generation counters.
  const progress = useMemo(
    () =>
      summarizeStoryTasks(tasks.filter((task) => task.type === "PAGE_IMAGE")),
    [tasks]
  )

  const mutation = trpc.page.generateBulk.useMutation({
    onSuccess: () => utils.task.listForStory.invalidate({ storyId }),
    onError: (error) => toast.error(error.message),
  })

  return {
    selected,
    isAllSelected: isAllSelected(selected, pageIds),
    toggle: (id: string) => setSelected((prev) => toggle(prev, id)),
    selectAll: () => setSelected(selectAll(pageIds)),
    selectNone: () => setSelected(selectNone()),
    progress,
    generate: () => {
      const ids = pageIds.filter((id) => selected.has(id))
      if (ids.length > 0) mutation.mutate({ storyId, pageIds: ids })
    },
  }
}
