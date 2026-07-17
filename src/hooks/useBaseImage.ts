"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"

import { isActiveStatus, latestTask } from "@/server/domain/taskMachine"
import type {
  ClientCharacter as Character,
  ClientStory as Story,
  Task,
} from "@/server/domain/types"
import { trpc } from "@/lib/trpc"
import { useStoryTasks } from "@/hooks/useTaskPolling"

export function canGenerateBase(
  story: Story | undefined,
  characters: Character[],
  activeTask: Task | undefined
): boolean {
  return Boolean(
    story && characters.length > 0 && !isActiveStatus(activeTask?.status)
  )
}

// The most recently created BASE_IMAGE task, whatever its status. Deriving this
// from the story's task list (rather than a mutation-scoped id) means an
// in-flight generation is still reflected after a full page reload.
export function latestBaseImageTask(tasks: Task[]): Task | undefined {
  return latestTask(tasks, (task) => task.type === "BASE_IMAGE")
}

export function useBaseImage(storyId: string) {
  const utils = trpc.useUtils()
  const [story] = trpc.story.get.useSuspenseQuery({ storyId })
  const [characters] = trpc.character.listForStory.useSuspenseQuery({ storyId })
  const { tasks } = useStoryTasks(storyId)

  const activeTask = latestBaseImageTask(tasks)
  const status = activeTask?.status

  const generate = trpc.story.generateBaseImage.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.task.listForStory.invalidate({ storyId }),
        // A task can finish before the first poll (as it does with the E2E
        // inline dispatcher). Refresh the story here as well as on a witnessed
        // active → terminal transition so the new URL is never left stale.
        utils.story.get.invalidate({ storyId }),
      ])
    },
    onError: (error) => toast.error(error.message),
  })

  // Fire success/failure side effects only when we witnessed the tracked task
  // transition out of an active status this session — so a task that was
  // already terminal on mount (e.g. after reload) doesn't re-toast history.
  const previousStatus = useRef(status)
  useEffect(() => {
    const wasActive = isActiveStatus(previousStatus.current)
    previousStatus.current = status
    if (!wasActive) return
    if (status === "SUCCEEDED") {
      void utils.story.get.invalidate({ storyId })
      toast.success("Base image ready")
    } else if (status === "FAILED") {
      toast.error(activeTask?.error ?? "Base image generation failed")
    }
    // Only react to status transitions of the tracked task.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  return {
    story,
    characters,
    imageUrl: story.baseImageUrl ?? undefined,
    taskState: generate.isPending ? ("PENDING" as const) : status,
    taskError: activeTask?.error ?? undefined,
    canGenerate:
      !generate.isPending && canGenerateBase(story, characters, activeTask),
    onGenerate: () => generate.mutate({ storyId }),
  }
}
