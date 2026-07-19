"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { deriveParseState } from "@/lib/parseState"
import { trpc } from "@/lib/trpc"
import { useTask } from "@/hooks/useTaskPolling"
import type { StoryKind } from "@/server/domain/types"

/**
 * Owns the `story.parse` mutation and its task polling. Lives apart from the
 * script editor because parsing happens on the Characters step — the roster and
 * rules must exist before the script is split into pages.
 */
export function useStoryParse(storyId: string, kind: StoryKind = "STORY") {
  const utils = trpc.useUtils()
  const [story] = trpc.story.get.useSuspenseQuery({ storyId, kind })
  const [taskId, setTaskId] = useState("")

  const parse = trpc.story.parse.useMutation({
    onSuccess: ({ taskId }) => setTaskId(taskId),
    onError: (error) => toast.error(error.message),
  })

  const task = useTask(taskId).data
  const parseState = parse.isPending
    ? { state: "parsing" as const }
    : deriveParseState(task, {
        status: story.status,
        pageCount: story.counts.pages,
      })

  // Refresh the persisted story once the parse task reaches a terminal state so
  // the derived page count and status reflect the freshly written pages.
  const lastTerminal = useRef<string>("")
  useEffect(() => {
    if (!task || (task.status !== "SUCCEEDED" && task.status !== "FAILED"))
      return
    if (lastTerminal.current === task.id) return
    lastTerminal.current = task.id
    void utils.story.get.invalidate({ storyId, kind })
    if (task.status === "SUCCEEDED") toast.success("Story parsed")
  }, [task, storyId, kind, utils])

  return {
    parseState: parseState.state,
    pageCount: parseState.pageCount,
    error: parseState.error,
    canParse: story.script.trim().length > 0,
    canReparse: story.status !== "READY",
    onParse: () => parse.mutate({ storyId }),
  }
}
