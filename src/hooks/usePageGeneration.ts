"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"

import { latestTask } from "@/server/domain/taskMachine"
import type { PageImage, Task, TaskStatus } from "@/server/domain/types"
import { trpc } from "@/lib/trpc"
import { useStoryTasks } from "@/hooks/useTaskPolling"

export type PageGenState = "idle" | "queued" | "generating" | "done" | "failed"

function latestImage(images: PageImage[]): PageImage | undefined {
  return images.reduce<PageImage | undefined>(
    (latest, image) =>
      !latest || image.variant > latest.variant ? image : latest,
    undefined
  )
}

/**
 * The generation state implied by a page's PAGE_IMAGE tasks. `tasks` must
 * already be filtered to this page; `hasImage` is whether it has a stored
 * variant. Pure so both the focused editor and the grid can share it.
 */
export function pageGenStateFromTasks(
  tasks: Task[],
  hasImage: boolean
): PageGenState {
  return pageGenState(latestTask(tasks)?.status, hasImage)
}

function pageGenState(
  status: TaskStatus | undefined,
  hasImage: boolean
): PageGenState {
  switch (status) {
    case "PENDING":
      return "queued"
    case "RUNNING":
      return "generating"
    case "FAILED":
      return "failed"
    default:
      // SUCCEEDED, or no task this session: an existing variant means done.
      return hasImage ? "done" : "idle"
  }
}

/**
 * Derive one page's generation state and latest variant URL. `tasks` must
 * already be filtered to this page's PAGE_IMAGE tasks.
 */
export function derivePageGenState(
  tasks: Task[],
  images: PageImage[]
): {
  state: PageGenState
  latestImageUrl: string | undefined
  error: string | undefined
} {
  const image = latestImage(images)
  const task = latestTask(tasks)
  return {
    state: pageGenState(task?.status, Boolean(image)),
    latestImageUrl: image?.url,
    error: task?.status === "FAILED" ? (task.error ?? undefined) : undefined,
  }
}

export function usePageGeneration(pageId: string, storyId: string) {
  const utils = trpc.useUtils()
  const { tasks } = useStoryTasks(storyId)
  const imagesQuery = trpc.page.listImages.useQuery(
    { pageId },
    { enabled: Boolean(pageId) }
  )

  const pageTasks = tasks.filter(
    (task) => task.type === "PAGE_IMAGE" && task.pageId === pageId
  )
  const { state, latestImageUrl, error } = derivePageGenState(
    pageTasks,
    imagesQuery.data ?? []
  )

  const mutation = trpc.page.generate.useMutation({
    onSuccess: () => utils.task.listForStory.invalidate({ storyId }),
    onError: (error) => toast.error(error.message),
  })
  const visibleState: PageGenState = mutation.isPending ? "queued" : state

  // Refetch variants (and surface a toast) only when we witnessed the tracked
  // task leave an active status this session, so a page that mounts on an
  // already-terminal task doesn't re-toast stale history.
  const previousState = useRef(visibleState)
  useEffect(() => {
    const wasActive =
      previousState.current === "queued" ||
      previousState.current === "generating"
    previousState.current = visibleState
    if (!wasActive) return
    if (visibleState === "done") {
      void utils.page.listImages.invalidate({ pageId })
      toast.success("Page image ready")
    } else if (visibleState === "failed") {
      toast.error(error ?? "Page image generation failed")
    }
    // Only react to state transitions of the tracked page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleState])

  return {
    state: visibleState,
    error,
    latestImageUrl,
    generate: (steeringText?: string) =>
      mutation.mutate({ pageId, steeringText }),
    retry: () => mutation.mutate({ pageId }),
  }
}
