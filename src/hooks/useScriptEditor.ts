"use client"

import { useEffect, useRef, useState } from "react"
import { trpc } from "@/lib/trpc"
import type { StoryKind } from "@/server/domain/types"

const SAVE_DEBOUNCE_MS = 800

/**
 * Title and script editing for the Script step. Parsing is deliberately absent:
 * it belongs to the Characters step (`useStoryParse`) so the roster and rules
 * are in place before the story is split into pages.
 */
export function useScriptEditor(storyId: string, kind: StoryKind = "STORY") {
  const [story] = trpc.story.get.useSuspenseQuery({ storyId, kind })

  const [title, setTitle] = useState(story.title)
  const [script, setScript] = useState(story.script)

  const updateTitle = trpc.story.updateTitle.useMutation()
  const updateScript = trpc.story.updateScript.useMutation()

  const titleTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const scriptTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  // Pending debounced writes, flushed on unmount. Parsing now happens on the
  // Characters step, so leaving this screen within the debounce window is the
  // normal path to it — dropping the timer without flushing would parse stale
  // script text.
  const pending = useRef<{ title?: string; script?: string }>({})
  // The unmount effect must not close over the first render's mutations, so
  // they are refreshed through a ref rather than added as effect dependencies
  // (which would re-arm the cleanup on every render and flush too early).
  const save = useRef({ updateTitle, updateScript, storyId })
  useEffect(() => {
    save.current = { updateTitle, updateScript, storyId }
  })
  useEffect(
    () => () => {
      clearTimeout(titleTimer.current)
      clearTimeout(scriptTimer.current)
      const { title: pendingTitle, script: pendingScript } = pending.current
      pending.current = {}
      const current = save.current
      if (pendingTitle !== undefined)
        current.updateTitle.mutate({
          storyId: current.storyId,
          title: pendingTitle,
        })
      if (pendingScript !== undefined)
        current.updateScript.mutate({
          storyId: current.storyId,
          script: pendingScript,
        })
    },
    []
  )

  function onChangeTitle(value: string) {
    setTitle(value)
    pending.current.title = value.trim()
    clearTimeout(titleTimer.current)
    titleTimer.current = setTimeout(() => {
      delete pending.current.title
      updateTitle.mutate({ storyId, title: value.trim() })
    }, SAVE_DEBOUNCE_MS)
  }

  function onChangeScript(value: string) {
    setScript(value)
    // A blank script is never saved, so clear the pending entry rather than
    // leaving the previous keystroke behind for the unmount flush to resurrect.
    if (value.trim()) pending.current.script = value
    else delete pending.current.script
    clearTimeout(scriptTimer.current)
    scriptTimer.current = setTimeout(() => {
      delete pending.current.script
      if (value.trim()) updateScript.mutate({ storyId, script: value })
    }, SAVE_DEBOUNCE_MS)
  }

  return { title, script, onChangeTitle, onChangeScript }
}
