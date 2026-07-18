"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { deriveParseState } from "@/lib/parseState"
import { trpc } from "@/lib/trpc"
import { useTask } from "@/hooks/useTaskPolling"
import type { StoryKind } from "@/server/domain/types"

const SAVE_DEBOUNCE_MS = 800

export function useScriptEditor(storyId: string, kind: StoryKind = "STORY") {
  const utils = trpc.useUtils()
  const [story] = trpc.story.get.useSuspenseQuery({ storyId, kind })

  const [title, setTitle] = useState(story.title)
  const [script, setScript] = useState(story.script)
  const [taskId, setTaskId] = useState("")

  const updateTitle = trpc.story.updateTitle.useMutation()
  const updateScript = trpc.story.updateScript.useMutation()
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

  const titleTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const scriptTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(
    () => () => {
      clearTimeout(titleTimer.current)
      clearTimeout(scriptTimer.current)
    },
    []
  )

  function onChangeTitle(value: string) {
    setTitle(value)
    clearTimeout(titleTimer.current)
    titleTimer.current = setTimeout(() => {
      updateTitle.mutate({ storyId, title: value.trim() })
    }, SAVE_DEBOUNCE_MS)
  }

  function onChangeScript(value: string) {
    setScript(value)
    clearTimeout(scriptTimer.current)
    scriptTimer.current = setTimeout(() => {
      if (value.trim()) updateScript.mutate({ storyId, script: value })
    }, SAVE_DEBOUNCE_MS)
  }

  async function onParse() {
    // Flush any pending debounced saves so the task parses the latest text and
    // the title write can't race the handler's title-from-parse update.
    clearTimeout(scriptTimer.current)
    clearTimeout(titleTimer.current)
    const saves: Promise<unknown>[] = []
    if (script.trim() && script !== story.script)
      saves.push(updateScript.mutateAsync({ storyId, script }))
    if (title.trim() !== story.title.trim())
      saves.push(updateTitle.mutateAsync({ storyId, title: title.trim() }))
    try {
      await Promise.all(saves)
      parse.mutate({ storyId })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  return {
    title,
    script,
    parseState: parseState.state,
    pageCount: parseState.pageCount,
    error: parseState.error,
    canReparse: story.status !== "READY",
    onChangeTitle,
    onChangeScript,
    onParse,
  }
}
