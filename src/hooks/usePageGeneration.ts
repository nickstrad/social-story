"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"

import type { PageImage, Task } from "@/server/domain/types"
import { trpc } from "@/lib/trpc"
import { useStoryTasks } from "@/hooks/useTaskPolling"

export type PageGenState = "idle" | "queued" | "generating" | "done" | "failed"

function latestTask(tasks: Task[]): Task | undefined {
  return tasks.reduce<Task | undefined>(
    (latest, task) =>
      !latest || task.createdAt > latest.createdAt ? task : latest,
    undefined
  )
}

function latestImage(images: PageImage[]): PageImage | undefined {
  return images.reduce<PageImage | undefined>(
    (latest, image) =>
      !latest || image.variant > latest.variant ? image : latest,
    undefined
  )
}

/**
 * Derive one page's generation state from its PAGE_IMAGE tasks and its stored
 * variants. `tasks` must already be filtered to this page's PAGE_IMAGE tasks.
 * Pure so it can be unit-tested without React or the network.
 */
export function derivePageGenState(
  tasks: Task[],
  images: PageImage[]
): { state: PageGenState; latestImageUrl: string | undefined } {
  const image = latestImage(images)
  const latestImageUrl = image?.url

  const task = latestTask(tasks)
  let state: PageGenState
  switch (task?.status) {
    case "PENDING":
      state = "queued"
      break
    case "RUNNING":
      state = "generating"
      break
    case "FAILED":
      state = "failed"
      break
    default:
      // SUCCEEDED, or no task this session: an existing variant means done.
      state = image ? "done" : "idle"
  }
  return { state, latestImageUrl }
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
  const { state, latestImageUrl } = derivePageGenState(
    pageTasks,
    imagesQuery.data ?? []
  )

  const mutation = trpc.page.generate.useMutation({
    onSuccess: () => utils.task.listForStory.invalidate({ storyId }),
    onError: (error) => toast.error(error.message),
  })

  // Refetch variants (and surface a toast) only when we witnessed the tracked
  // task leave an active status this session, so a page that mounts on an
  // already-terminal task doesn't re-toast stale history.
  const previousState = useRef(state)
  useEffect(() => {
    const wasActive =
      previousState.current === "queued" ||
      previousState.current === "generating"
    previousState.current = state
    if (!wasActive) return
    if (state === "done") {
      void utils.page.listImages.invalidate({ pageId })
      toast.success("Page image ready")
    } else if (state === "failed") {
      toast.error("Page image generation failed")
    }
    // Only react to state transitions of the tracked page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  return {
    state,
    latestImageUrl,
    generate: (steeringText?: string) =>
      mutation.mutate({ pageId, steeringText }),
    retry: () => mutation.mutate({ pageId }),
  }
}
