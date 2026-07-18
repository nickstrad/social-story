"use client"

import { useState } from "react"
import { toast } from "sonner"

import { trpc } from "@/lib/trpc"
import type { StoryKind } from "@/server/domain/types"
import { validateUpload } from "@/server/domain/upload"

export type PageImageUploadState = "idle" | "uploading" | "failed"

function apiError(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object" || !("error" in payload)) return
  return typeof payload.error === "string" ? payload.error : undefined
}

export function usePageImageUpload({
  storyId,
  pageId,
  storyKind,
}: {
  storyId: string
  pageId: string
  storyKind: StoryKind
}) {
  const utils = trpc.useUtils()
  const [state, setState] = useState<PageImageUploadState>("idle")

  function validateFile(file: File): boolean {
    const validation = validateUpload({ mimeType: file.type, size: file.size })
    if (validation.valid) {
      setState("idle")
      return true
    }
    setState("failed")
    toast.error(validation.error)
    return false
  }

  async function upload(file: File): Promise<boolean> {
    if (!validateFile(file)) return false

    setState("uploading")
    const body = new FormData()
    body.set("storyId", storyId)
    body.set("pageId", pageId)
    body.set("file", file)

    try {
      const response = await fetch("/api/upload/page-image", {
        method: "POST",
        body,
      })
      const payload: unknown = await response.json()
      if (!response.ok) {
        throw new Error(apiError(payload) ?? "Page image upload failed")
      }

      await Promise.all([
        utils.page.listImages.invalidate({ pageId }),
        utils.story.get.invalidate({ storyId, kind: storyKind }),
      ])
      setState("idle")
      toast.success("Page image uploaded")
      return true
    } catch (error) {
      setState("failed")
      toast.error(
        error instanceof Error ? error.message : "Page image upload failed"
      )
      return false
    }
  }

  return { state, validateFile, upload }
}
