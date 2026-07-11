"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"

import { isActiveStatus } from "@/server/domain/taskMachine"
import type { Task } from "@/server/domain/types"
import { exportReadiness } from "@/lib/exportReadiness"
import { trpc } from "@/lib/trpc"
import { useStoryTasks } from "@/hooks/useTaskPolling"

// The most recently created PDF_EXPORT task, whatever its status. Derived from
// the story's task list so an in-flight export survives a full page reload.
export function latestExportTask(tasks: Task[]): Task | undefined {
  return tasks
    .filter((task) => task.type === "PDF_EXPORT")
    .reduce<Task | undefined>(
      (latest, task) =>
        !latest || task.createdAt > latest.createdAt ? task : latest,
      undefined
    )
}

export function useExport(storyId: string) {
  const utils = trpc.useUtils()
  const [story] = trpc.story.get.useSuspenseQuery({ storyId })
  const [latest] = trpc.pdf.latest.useSuspenseQuery({ storyId })
  const { tasks } = useStoryTasks(storyId)

  const readiness = exportReadiness(story.pages)
  const activeTask = latestExportTask(tasks)
  const status = activeTask?.status

  const exportMutation = trpc.pdf.export.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.task.listForStory.invalidate({ storyId }),
        utils.pdf.latest.invalidate({ storyId }),
        utils.story.get.invalidate({ storyId }),
      ])
    },
    onError: (error) => toast.error(error.message),
  })

  // Fire success/failure toasts only when we witnessed the tracked task leave
  // an active status this session, so a task already terminal on mount (e.g.
  // after reload) doesn't re-toast history.
  const previousStatus = useRef(status)
  useEffect(() => {
    const wasActive = isActiveStatus(previousStatus.current)
    previousStatus.current = status
    if (!wasActive) return
    if (status === "SUCCEEDED") {
      void utils.pdf.latest.invalidate({ storyId })
      void utils.story.get.invalidate({ storyId })
      toast.success("PDF ready")
    } else if (status === "FAILED") {
      toast.error(activeTask?.error ?? "PDF export failed")
    }
    // Only react to status transitions of the tracked task.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  return {
    readyPages: readiness.ready,
    missingPages: readiness.missing,
    taskState: status,
    pdfUrl: latest.url ?? undefined,
    onExport: () => exportMutation.mutate({ storyId }),
  }
}
