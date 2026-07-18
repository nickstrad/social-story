"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"

import { isActiveStatus, latestTask } from "@/server/domain/taskMachine"
import type {
  ClientCharacter as Character,
  ClientStory as Story,
  Task,
  StoryKind,
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

interface BaseImageSource {
  storyId: string
  title: string
  baseImageUrl: string
  libraryCharacterIds: (string | null)[]
}

export function matchingBaseImageSources(
  characters: Character[],
  sources: BaseImageSource[]
): BaseImageSource[] {
  const targetIds = characters.map((character) => character.libraryCharacterId)
  if (targetIds.length === 0 || targetIds.some((id) => id === null)) return []
  const target = new Set(targetIds as string[])
  return sources.filter((source) => {
    if (
      source.libraryCharacterIds.some((id) => id === null) ||
      source.libraryCharacterIds.length !== targetIds.length
    ) {
      return false
    }
    const sourceIds = new Set(source.libraryCharacterIds as string[])
    return (
      sourceIds.size === target.size &&
      [...target].every((id) => sourceIds.has(id))
    )
  })
}

export function useBaseImage(storyId: string, kind: StoryKind = "STORY") {
  const utils = trpc.useUtils()
  const storyKey = { storyId, kind }
  const [story] = trpc.story.get.useSuspenseQuery(storyKey)
  const [characters] = trpc.character.listForStory.useSuspenseQuery({ storyId })
  const [sources] = trpc.story.baseImageSources.useSuspenseQuery({ storyId })
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
        utils.story.get.invalidate(storyKey),
      ])
    },
    onError: (error) => toast.error(error.message),
  })
  const reuse = trpc.story.reuseBaseImage.useMutation({
    onSuccess: async () => {
      await utils.story.get.invalidate(storyKey)
      toast.success("Base image reused")
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
      void utils.story.get.invalidate(storyKey)
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
      !generate.isPending &&
      !reuse.isPending &&
      canGenerateBase(story, characters, activeTask),
    onGenerate: () => generate.mutate({ storyId }),
    reuseSources: matchingBaseImageSources(characters, sources),
    isReusing: reuse.isPending,
    onReuse: (sourceStoryId: string) =>
      reuse.mutate({ storyId, sourceStoryId }),
  }
}
