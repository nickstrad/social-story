"use client"

import { useEffect, useRef, useState } from "react"

import type { Page } from "@/server/domain/types"
import { trpc } from "@/lib/trpc"

const SAVE_DEBOUNCE_MS = 600

/**
 * Local draft state for one page's editable text fields. Each keystroke updates
 * the draft immediately and schedules a debounced `page.update`; `dirty` is true
 * while the draft differs from the persisted page.
 *
 * Expects a stable page identity for its lifetime — callers remount it (key by
 * `page.id`) when the focused page changes so drafts reset cleanly.
 */
export function usePageForm(page: Page) {
  const utils = trpc.useUtils()
  const [text, setText] = useState(page.text)
  const [imagePrompt, setImagePrompt] = useState(page.imagePrompt)
  const [steering, setSteering] = useState(page.steeringText ?? "")

  const update = trpc.page.update.useMutation({
    onSuccess: () => utils.story.get.invalidate({ storyId: page.storyId }),
  })

  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  // Holds the latest scheduled-but-unsaved snapshot so a debounced save that is
  // still pending when the hook unmounts (Prev/Next, "Back to grid", delete —
  // all remount by `page.id`) is flushed rather than silently dropped.
  const pending = useRef<{
    text: string
    imagePrompt: string
    steeringText: string
  }>(undefined)

  // Keep the flusher in a ref so the unmount effect stays [] (fires once) while
  // still seeing the current mutation and pending snapshot. Assigned in an
  // effect (not during render) so it never mutates a ref mid-render.
  const flush = useRef<() => void>(undefined)
  useEffect(() => {
    flush.current = () => {
      if (!pending.current) return
      clearTimeout(timer.current)
      update.mutate({ pageId: page.id, ...pending.current })
      pending.current = undefined
    }
  })
  useEffect(() => () => flush.current?.(), [])

  const dirty =
    text !== page.text ||
    imagePrompt !== page.imagePrompt ||
    steering !== (page.steeringText ?? "")

  // Always send the full field snapshot so a rapid edit to one field never
  // drops an earlier, still-unsaved edit to another.
  function schedule(next: {
    text: string
    imagePrompt: string
    steeringText: string
  }) {
    clearTimeout(timer.current)
    pending.current = next
    timer.current = setTimeout(() => {
      update.mutate({ pageId: page.id, ...next })
      pending.current = undefined
    }, SAVE_DEBOUNCE_MS)
  }

  return {
    text,
    imagePrompt,
    steering,
    dirty,
    onChangeText: (value: string) => {
      setText(value)
      schedule({ text: value, imagePrompt, steeringText: steering })
    },
    onChangeImagePrompt: (value: string) => {
      setImagePrompt(value)
      schedule({ text, imagePrompt: value, steeringText: steering })
    },
    onChangeSteering: (value: string) => {
      setSteering(value)
      schedule({ text, imagePrompt, steeringText: value })
    },
  }
}
