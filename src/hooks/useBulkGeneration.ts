"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"

import { summarizeStoryTasks } from "@/server/domain/taskMachine"
import type { Task } from "@/server/domain/types"
import { isAllSelected, selectAll, selectNone, toggle } from "@/lib/selection"
import { trpc } from "@/lib/trpc"
import { useStoryTasks } from "@/hooks/useTaskPolling"

// Aggregate progress across this story's PAGE_IMAGE tasks only, so a base image
// or parse task doesn't leak into the bulk-generation counters. Pure so the
// filter can be unit-tested without React.
export function summarizePageProgress(tasks: Task[]) {
  return summarizeStoryTasks(tasks.filter((task) => task.type === "PAGE_IMAGE"))
}

export function useBulkGeneration(storyId: string, pageIds: string[]) {
  const utils = trpc.useUtils()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const { tasks } = useStoryTasks(storyId)

  const progress = useMemo(() => summarizePageProgress(tasks), [tasks])

  const mutation = trpc.page.generateBulk.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.task.listForStory.invalidate({ storyId }),
        // Inline/very fast dispatch can complete before the UI observes an
        // active task, so refresh selected image URLs immediately too.
        utils.story.get.invalidate({ storyId }),
      ])
    },
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
